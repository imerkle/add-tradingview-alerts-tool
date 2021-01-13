import 'source-map-support/register'
import csv from 'csv-parser'
import fs from "fs"
import puppeteer from "puppeteer"
import YAML from "yaml"

const DELAYS = {
    LONG: 3000,
    MED: 1500,
    SHORT: 800,
    VERYSHORT: 500,
}
function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time)
    });
}


const readFilePromise = (filename: string) => {
    return new Promise<any>((resolve, reject) => {
        const results = []

        fs.createReadStream(filename)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                resolve(results)
            }).on('error', () => {
                reject("Unable to read csv")
            })
    })
}

const fetchFirstXPath = async (selector: string, page, timeout = 20000) => {
    //console.warn(`selector: ${selector}`)
    await page.waitForXPath(selector, { timeout })
    const elements = await page.$x(selector)
    return elements[0]
}

// made using XPath Generator 1.1.0

const addAlert = async (symbol: string, quote: string, base: string, rowName: string, alertConfig: any, page) => {


    const { interval, indicator, indicator_name, signal, option, message } = alertConfig
    const alertName = (indicator_name || indicator) + "_" + symbol + "_" + interval;

    //await page.waitForXPath('//*[@id="header-toolbar-symbol-search"]/div/input')


    const symbolHeaderInput = await fetchFirstXPath('//div[@id="header-toolbar-symbol-search"]', page)
    await symbolHeaderInput.click()
    await delay(DELAYS.SHORT);
    const symbolInput = await fetchFirstXPath('//input[@data-role=\'search\']', page)
    await symbolInput.type(`  ${symbol}${String.fromCharCode(13)}`)
    await delay(DELAYS.LONG);

    let alertItem = undefined;
    try {
        alertItem = await fetchFirstXPath(`//div[@data-name='alert-item-name' and contains(text(), '${alertName}')]`, page, 5000)
    } catch (e) {
    }
    if (alertItem != undefined) {
        return;
    }

    if (interval) {
        const intervalHeaderInput = await fetchFirstXPath('//div[@id="header-toolbar-intervals"]', page)
        await intervalHeaderInput.click()
        await delay(DELAYS.SHORT);
        const menuInnerDropDownDiv = await fetchFirstXPath(`//*[@data-value='${interval}']`, page);
        const parentElement = (await menuInnerDropDownDiv.$x('..'))[0];
        parentElement.click();
        await delay(DELAYS.LONG);
    }

    const alertButton = await fetchFirstXPath('//*[@id="header-toolbar-alerts"]', page)
    await alertButton.click()
    await delay(DELAYS.SHORT);

    if (indicator) {
        const conditionDropDown = await fetchFirstXPath("//*[@class='tv-alert-dialog__group-item tv-alert-dialog__group-item--left js-main-series-select-wrap']/*[@class='tv-control-select__wrap tv-dropdown-behavior tv-control-select--size_small' and 1]/*[@class='tv-control-select__control tv-dropdown-behavior__button' and 1]", page)
        conditionDropDown.click()
        await delay(DELAYS.VERYSHORT);

        const optionMTF = await fetchFirstXPath(`//*[@class='tv-control-select__option-wrap' and contains(text(), '${indicator}')]`, page)
        optionMTF.click()
        await delay(DELAYS.VERYSHORT);
    }
    if (signal) {
        const signalDropDown = await fetchFirstXPath("//*[@class='tv-control-fieldset__value tv-alert-dialog__fieldset-value js-condition-operator-input-wrap']/span[@class='tv-control-select__wrap tv-dropdown-behavior tv-control-select--size_small' and 1]/span[@class='tv-control-select__control tv-dropdown-behavior__button' and 1]", page)
        signalDropDown.click()
        await delay(DELAYS.VERYSHORT);
        const optionSignal = await fetchFirstXPath(`//*[@class='tv-control-select__option-wrap' and contains(text(), '${signal}')]`, page)
        optionSignal.click()

        await delay(DELAYS.SHORT);
    }

    if (alertConfig.textinputs) {
        for (const textinput of alertConfig.textinputs) {
            const inputtextbox = await fetchFirstXPath(`//*[@name='${textinput.name}']`, page,)
            inputtextbox.click({ clickCount: 3 })
            await delay(DELAYS.SHORT);
            await inputtextbox.type(textinput.value)
            await delay(DELAYS.MED);
        }
        await delay(DELAYS.SHORT);
    }
    if (alertConfig.webhookurl) {
        const inputtextbox = await fetchFirstXPath(`//*[@name='webhook-url']`, page,)
        inputtextbox.click({ clickCount: 3 })
        await delay(DELAYS.SHORT);
        await inputtextbox.type(alertConfig.webhookurl)
        await delay(DELAYS.MED);
    }
    if (alertConfig.dropdowns) {
        for (const dropdown of alertConfig.dropdowns) {

            await delay(DELAYS.VERYSHORT);
            const signalDropDown = await fetchFirstXPath(dropdown.xpath, page)
            signalDropDown.click()

            await delay(DELAYS.VERYSHORT);
            const optionSignal = await fetchFirstXPath(`${dropdown.xpath}//*[@class='tv-control-select__option-wrap' and contains(text(), '${dropdown.value}')]`, page)
            optionSignal.click()
        }
        await delay(DELAYS.SHORT);
    }
    //

    await delay(1000);
    const freqButton = await fetchFirstXPath(`//*[text()='${option}']`, page)
    freqButton.click()

    await delay(1000);

    //const alertName = (rowName || alertConfig.name || "").toString().replace(/{{symbol}}/g, symbol).replace(/{{quote}}/g, quote).replace().replace(/{{base}}/g, base).replace()

    if (!!alertName) {
        const nameInput = await fetchFirstXPath("//input[@name='alert-name']", page)
        nameInput.click()
        await nameInput.press('Backspace');
        await nameInput.type(alertName)
        await delay(DELAYS.SHORT);

    }

    //await page.evaluate("textarea[name=description]", el => el.value = "")

    const messageTextarea = await fetchFirstXPath("//textarea[@class='tv-control-textarea']", page)

    messageTextarea.click({ clickCount: 3 })

    await delay(DELAYS.VERYSHORT);
    await messageTextarea.press('Backspace');
    await delay(DELAYS.VERYSHORT);

    const messageText = message.toString().replace(/{{quote}}/g, quote).replace().replace(/{{base}}/g, base).replace()

    await messageTextarea.type(messageText)

    await delay(DELAYS.SHORT);
    const continueButton = await fetchFirstXPath("//span[@class='tv-button__loader']", page)
    continueButton.click()

    await delay(DELAYS.SHORT);

    try {
        const continueAnywayButton = await fetchFirstXPath("//*[text()='Continue anyway']", page, 3000)
        continueAnywayButton.click()
        await delay(DELAYS.LONG);
    } catch (error) {
        //must not be alert on an indicator
    }


}


const main = async () => {

    const configFileName = process.argv[2] || "config.yml"

    if (!fs.exists) {
        console.error("Unable to find config file: ", configFileName)
    }

    console.log("Using config file: ", configFileName)

    const configString = await fs.readFileSync(configFileName, { encoding: "utf-8" })

    const config = YAML.parse(configString)

    const { alerts: alertConfigs } = config

    //console.log("alertConfig", alertConfig.message)

    const browser = await puppeteer.launch({
        headless: false, userDataDir: "./user_data",
        defaultViewport: null,
        args: [
            `--app=${config.tradingview.chartUrl}#signin`,
            // '--window-size=1440,670'
        ]
    })

    await delay(DELAYS.LONG)

    const page = (await browser.pages())[0];

    const isAccessDenied = await page.evaluate(() => {
        return document.title.includes("Denied");
    });

    // const page = await browser.newPage()
    // const response = await page.goto(config.tradingview.chartUrl + "#signin")

    if (isAccessDenied) {

        console.log("You'll need to sign into TradingView in this browser (one time only)\n...after signing in, press ctrl-c to kill this script, then run it again")
        await delay(1000000)

    } else {
        await delay(DELAYS.SHORT)

        const blackListRows = await readFilePromise(config.files.exclude)

        const isBlacklisted = (symbol: string) => {
            for (const row of blackListRows) {
                if (symbol.toLowerCase().includes(row.symbol.toLowerCase())) {
                    return true
                }
            }
            return false
        }

        const symbolRows = await readFilePromise(config.files.input)

        for (const row of symbolRows) {

            if (isBlacklisted(row.symbol)) {
                console.warn(`Not adding blacklisted symbol: `, row.symbol)
                continue
            }

            console.log(`Adding symbol: ${row.symbol}  ( ${row.base} priced in ${row.quote} )`)
            await delay(DELAYS.SHORT)
            for (const alertConfig of alertConfigs) {
                await addAlert(row.symbol, row.quote, row.base, row.name, alertConfig, page)
            }
        }
    }

    await delay(4000)
    await browser.close()

}


main().catch(error => console.error(error))
