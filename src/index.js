const { Command, flags } = require("@oclif/command");
const puppeteer = require("puppeteer");
const fs = require("fs-extra");
const path = require("path");
const { cli } = require("cli-ux");
const chalk = require("chalk");

class WsolCommand extends Command {
  async run() {
    cli.action.start("Checking");

    const start = new Date();

    const { flags } = this.parse(WsolCommand);
    const { args } = this.parse(WsolCommand);
    const name = flags.name || "world";
    const ghostMode = flags["ghost-mode"];

    const day = args.day;
    const month = args.month;
    const year = args.year;

    const searchDate = this.getDate(day, month, year);

    // this.log(`search date => ${searchDate}`)

    const config = await fs.readJson(
      path.join(this.config.configDir, "config.json")
    );

    const { username, password } = config;

    await this.startProcess(username, password, ghostMode);

    cli.action.stop();

    const leaveListOnDate = this.getLeaveListOn(this.leaveList, searchDate);

    this.showNames(leaveListOnDate);

    this.log("");
    // this.showExecutionTime(start);
  }

  getDate(day, month, year) {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(todayDate.getDate() - 1);

    const tomorrowDate = new Date();
    tomorrowDate.setDate(todayDate.getDate() + 1);
    if (day) {
      if (day === "today") {
        return todayDate;
      } else if (day === "tomorrow") {
        return tomorrowDate;
      } else if (day === "yesterday") {
        return yesterdayDate;
      } else {
        const dateStr = `${getYear(year)}-${getMonth(month)}-${getDay(
          day
        )} 00:00:00`;
        const date = new Date(dateStr);
        return date;
      }
    } else {
      return todayDate;
    }

    function getDay(day) {
      if (day) {
        return day;
      }
      return todayDate.getDay();
    }

    function getMonth(month) {
      if (month) {
        //means user is entering the month in number
        if (month.length < 3) {
          return month;
        } else {
          return translateMonthNameToNumber(month);
        }
      }
      return todayDate.getMonth() + 1;
    }

    function getYear(year) {
      if (year) {
        return year;
      }
      return todayDate.getFullYear();
    }

    function translateMonthNameToNumber(month) {
      switch (month.toLowerCase()) {
        case "jan":
          return 1;
        case "feb":
          return 2;
        case "mar":
          return 3;
        case "apr":
          return 4;
        case "may":
          return 5;
        case "jun":
          return 6;
        case "jul":
          return 7;
        case "aug":
          return 8;
        case "sep":
          return 9;
        case "oct":
          return 10;
        case "nov":
          return 11;
        case "dec":
          return 12;
      }
    }
  }

  showNames(leaveList) {
    this.log("");
    if (leaveList && leaveList.length > 0) {
      for (const [i, v] of leaveList.entries()) {
        this.log(chalk.bold.yellowBright(`${i + 1}.${v} `));
      }
    } else {
      this.log(chalk.red("No leave found!"));
    }
  }

  showExecutionTime(start) {
    const end = new Date() - start;
    console.info("Execution time: %dms", end);
  }

  getLeaveListOn(leaveList, searchDate) {
    function checkDate(startDate, endDate, searchDate) {
      const startInMilli = Date.parse(startDate + " 00:00:00");
      const endInMilli = Date.parse(endDate);

      const searchInMilli = Date.parse(searchDate);

      return startInMilli <= searchInMilli && endInMilli >= searchInMilli;
    }

    const namesOnLeave = leaveList
      .filter(leave => leave.color !== "red")
      .filter(leave => checkDate(leave.start, leave.end, searchDate))
      .map(leave => leave.title);

    return namesOnLeave;
  }

  async startProcess(username, password, ghostMode) {
    let browser;
    try {
      browser = await puppeteer.launch({ headless: !ghostMode });
      const page = await browser.newPage();

      const client = await page.target().createCDPSession();

      await client.send("Network.enable");

      await page.goto(
        "https://workflow.innov8tif.com/jw/web/userview/appcenter/v/_/home"
      );

      const btns = await page.$x(
        '//*[@id="page"]/header/div/div/div[5]/ul/li[2]/a'
      );
      const btnLogin = btns[0];

      await Promise.all([page.waitForNavigation(), btnLogin.click()]);

      await page.type("#j_username", username);

      await page.type("#j_password", password);

      const btns2 = await page.$x(
        '//*[@id="loginForm"]/table/tbody/tr[3]/td[2]/i/input'
      );
      const btnSubmitLogin = btns2[0];

      await Promise.all([page.waitForNavigation(), btnSubmitLogin.click()]);

      // await this.populateLeaveList(client, page);
      await this.populateWFHList(client, page);
    } catch (e) {
      this.log(e);
    } finally {
      await browser.close();
    }
  }

  async populateLeaveList(client, page) {
    await client.send("Network.setRequestInterception", {
      patterns: [
        {
          urlPattern: "*",
          resourceType: "XHR",
          interceptionStage: "HeadersReceived"
        }
      ]
    });

    client.on(
      "Network.requestIntercepted",
      async ({ interceptionId, request }) => {
        if (request.url.includes("CalendarMenu")) {
          const response = await client.send(
            "Network.getResponseBodyForInterception",
            { interceptionId }
          );

          const responseJsonString = response.base64Encoded
            ? Buffer.from(response.body, "base64").toString()
            : response.body;

          const responseJson = JSON.parse(responseJsonString);

          this.leaveList = responseJson;
        }

        client.send("Network.continueInterceptedRequest", { interceptionId });
      }
    );

    await page.goto(
      "https://workflow.innov8tif.com/jw/web/userview/innovEleave/app/_/leaveCalendarView"
    );

    await page.waitForSelector(
      "#fullcalendar div.fc-content-skeleton table tbody"
    );

    await page.screenshot({ path: "example.png" });
  }

  async populateWFHList(client, page) {
    await client.send("Network.setRequestInterception", {
      patterns: [
        {
          urlPattern: "*",
          resourceType: "XHR",
          interceptionStage: "HeadersReceived"
        }
      ]
    });

    client.on(
      "Network.requestIntercepted",
      async ({ interceptionId, request }) => {
        if (request.url.includes("calendar.google.com")) {
          const response = await client.send(
            "Network.getResponseBodyForInterception",
            { interceptionId }
          );

          const responseJsonString = response.base64Encoded
            ? Buffer.from(response.body, "base64").toString()
            : response.body;

          const responseJson = JSON.parse(responseJsonString);

          this.log(`wfh => ${responseJson}`);

          // this.leaveList = responseJson;
        }

        client.send("Network.continueInterceptedRequest", { interceptionId });
      }
    );

    await page.goto(
      "https://workflow.innov8tif.com/jw/web/userview/innovEleave/app/_/wfAnywhere"
    );

    // await page.waitForSelector(
    //   "#calendarContainer1"
    // );

    await page.screenshot({ path: "example.png" });
  }
}

WsolCommand.description = `Describe the command here
...
      Extra documentation goes here
        `;

WsolCommand.args = [{ name: "day" }, { name: "month" }, { name: "year" }];

WsolCommand.flags = {
  // add --version flag to show CLI version
  version: flags.version({ char: "v" }),
  // add --help flag to show CLI version
  help: flags.help({ char: "h" }),
  name: flags.string({ char: "n", description: "name to print" }),
  "ghost-mode": flags.boolean({
    default: false
  })
};

module.exports = WsolCommand;
