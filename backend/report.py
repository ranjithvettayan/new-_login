import sys
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

# Get report from command line args
import argparse
parser = argparse.ArgumentParser()
parser.add_argument("-r", "--report", required=True, help="Your report update message")
args = parser.parse_args()
report_message = args.report

# Setup
chrome_options = Options()
chrome_options.add_argument("--headless=new")
chrome_options.add_argument("--no-sandbox")
chrome_options.add_argument("--disable-dev-shm-usage")
browser = webdriver.Chrome(options=chrome_options)
wait = WebDriverWait(browser, 15)
actions = ActionChains(browser)

# Credentials
login_id = "ranjith.ravichandhiran"
pass_wd = "Ranrsr30#"

# Step 1: Open site and login
browser.get('https://www.vyhire.com/')
wait.until(EC.presence_of_element_located((By.XPATH, '//*[@id="username"]'))).send_keys(login_id)
browser.find_element(By.XPATH, '//*[@id="password"]').send_keys(pass_wd)
wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="form"]/p[4]/button'))).click()

# Step 2: Hover over menu and trigger submenu
menu_item = wait.until(EC.presence_of_element_located((By.XPATH, '/html/body/div[1]/div[3]/div[1]/div/ul/li[3]/a')))
actions.move_to_element(menu_item).perform()


sub_menu = wait.until(EC.element_to_be_clickable((By.XPATH, '/html/body/div[1]/div[3]/div[1]/div/ul/li[3]/ul/li')))
sub_menu.click()
time.sleep(3)  # Wait for report page to load

# Step 3: Click "CLICK TO TYPE TODAY's UPDATES"
report_button = wait.until(EC.element_to_be_clickable((By.XPATH, '//button[contains(text(), "CLICK TO TYPE TODAY\'s UPDATES")]')))
report_button.click()
time.sleep(1)

# Step 4: Enter the report in the editor
editor = wait.until(EC.presence_of_element_located((
    By.XPATH,
    '//div[contains(@class, "ck-editor__editable") and @contenteditable="true"]'
)))
editor.click()
editor.send_keys(report_message)

# Step 5: Click "Review & Confirm"
submit_button = wait.until(EC.element_to_be_clickable((By.XPATH, '//button[contains(text(), "Review & Confirm")]')))
submit_button.click()
time.sleep(2)
# Step 6: Confirm submission
confirm_button = wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="chk_agree"]')))
confirm_button.click()

final_click = wait.until(EC.element_to_be_clickable((By.XPATH, '//*[@id="buttons-2"]/button[2]')))
final_click.click()

time.sleep(10)
# Done
print("Report submitted successfully.")
browser.quit()
