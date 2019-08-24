const { Command, flags } = require('@oclif/command')
const puppeteer = require('puppeteer')
const fs = require('fs-extra')
const path = require('path')

class WsolCommand extends Command {
  async run() {
    const { flags } = this.parse(WsolCommand)
    const name = flags.name || 'world'
    this.log(`hello ${name} from ./src/index.js`)


    const config = await fs.readJson(path.join(this.config.configDir, 'config.json'))

    const { username, password } = config

    this.browse(username, password)
  }


  async browse(username, password) {
    let browser
    try {
      browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      await page.goto('https://workflow.innov8tif.com/jw/web/userview/appcenter/v/_/home');


      const btns = await page.$x('//*[@id="page"]/header/div/div/div[5]/ul/li[2]/a')
      const btnLogin = btns[0]

      await Promise.all([
        page.waitForNavigation(),
        btnLogin.click()
      ])

      await page.type('#j_username', username)

      await page.type('#j_password', password)






      const btns2 = await page.$x('//*[@id="loginForm"]/table/tbody/tr[3]/td[2]/i/input')
      const btnSubmitLogin = btns2[0]

      await Promise.all([
        page.waitForNavigation(),
        btnSubmitLogin.click()

      ])

      await page.goto('https://workflow.innov8tif.com/jw/web/userview/innovEleave/app/_/leaveCalendarView')


      await page.waitForSelector('#fullcalendar div.fc-content-skeleton table tbody')


      const weekRows = await page.$$('#fullcalendar div.fc-content-skeleton');

      this.log(`week rows => ${weekRows.length}`)



      const firstWeek = weekRows[0];




      const leaveObjs = await firstWeek.$$eval('td.fc-day-number', tds => {
        return tds.map(td => {
          return { date: td.getAttribute('data-date'),names:[] }
        })
      })

      this.log(`datetitle => ${JSON.stringify(leaveObjs)}`)

      const leaveRows = await firstWeek.$$('div.fc-content-skeleton tbody tr')

      this.log(`leave rows => ${leaveRows.length}`)


      const names = await leaveRows[0].$$eval('td', tds => {
        return tds.map(td => {

          const cell = td.querySelector('a')
          console.log('cell => ' + cell)
          if (cell) {
            const bgColor = cell.style.backgroundColor
            if (bgColor === 'green') {
              const spanName = cell.querySelector('span.fc-title')

              return spanName.innerHTML
            } else {
              return ""
            }
          }

          return td.innerHTML
        })
      })


      this.log(`leave rows with names  => ${leaveObjs.length}`)


      for (let i = 0; i < leaveObjs.length; i++) {
        leaveObjs[i].names.push(names[i])
      }



      this.log(`names => ${JSON.stringify(names)}`)

      this.log(`leave rows with names  => ${JSON.stringify(leaveObjs)}`)



      await page.screenshot({ path: 'example.png' });




    } catch (e) {
      this.log(e)
    } finally {
      await browser.close();
    }
  }
}

WsolCommand.description = `Describe the command here
...
Extra documentation goes here
`

WsolCommand.flags = {
  // add --version flag to show CLI version
  version: flags.version({ char: 'v' }),
  // add --help flag to show CLI version
  help: flags.help({ char: 'h' }),
  name: flags.string({ char: 'n', description: 'name to print' }),
}

module.exports = WsolCommand
