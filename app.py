from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time

chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
# IRMT
browser = webdriver.Chrome(options=chrome_options)
# browser = webdriver.Chrome()

frequency = 1

login_id = "ranjith.ravichandhiran"
pass_wd = "Ranrsr30#"

wait = WebDriverWait(browser, 10)

for i in range(frequency):
    browser.get('https://www.vyhire.com/')

    id = browser.find_element(by='xpath', value='//*[@id="username"]')
    id.send_keys(login_id)

    ps = browser.find_element(by='xpath', value='//*[@id="password"]')
    ps.send_keys(pass_wd)

    run = wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="form"]/p[4]/button')))

    run.click()

    time.sleep(10)

browser.quit()

