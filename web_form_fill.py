import selenium
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

# Process audio file
from icecream import ic
import symbl
import requests
from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from datetime import datetime, timedelta
import time
import code
import pyaudio
import wave

class Element:
    class ElementNotFetchableError(Exception):
        def __init__(self, *args):
            super().__init__(args)

        def __str__(self):
            return 'The element is not fetchable.'

    class FetchFailureError(Exception):
        def __init__(self, name, *args):
            super().__init__(args)
            self.name = name

        def __str__(self):
            return f'An attempt to fetch the {self.name} element failed.'

    def __init__(self, driver, name, method, selector, delay=30, element=None, optional=False):
        self.driver = driver
        self.name = name
        self.method = method
        self.selector = selector
        self.element = element
        self.optional = optional
        if not element:
            self.fetch(delay=delay)

    def fetch(self, delay=10, elapsed=0, clickable=True):
        if not self.method:
            raise self.ElementNotFetchableError()

        start = time.perf_counter()  # Initialize start here

        by = {
            "ID": By.ID,
            "XPATH": By.XPATH,
            "CSS_SELECTOR": By.CSS_SELECTOR,
        }.get(self.method, By.XPATH)

        ec = EC.element_to_be_clickable if clickable else EC.presence_of_element_located

        try:
            self.element = WebDriverWait(self.driver, delay).until(ec((by, self.selector)))
        except (TimeoutException, NoSuchElementException) as e:
            if self.optional:
                self.element = None  # If element is optional, do not raise an exception
            else:
                raise self.FetchFailureError(self.name)
        except selenium.common.exceptions.StaleElementReferenceException as e:
            if elapsed < delay:
                time.sleep(0.1)
                elapsed += time.perf_counter() - start  # Now start is defined
                self.fetch(delay=delay, elapsed=elapsed, clickable=clickable)
            else:
                if not self.optional:
                    raise self.FetchFailureError(self.name)
                
    def click(self, delay=15, elapsed=0):
        start = time.perf_counter()
        try:
            self.element.click()
            return True
        except selenium.common.exceptions.ElementClickInterceptedException:
            elapsed = elapsed + time.perf_counter()-start
            if elapsed < delay:
                time.sleep(0.1)
                ic("click intercepted", elapsed, delay)
                return self.click(delay, elapsed)
            else:
                f"Element click was intercepted for more than {delay} seconds"
                return False
        except selenium.common.exceptions.StaleElementReferenceException:
            elapsed = elapsed + time.perf_counter()-start
            if elapsed < delay:
                time.sleep(0.1)
                try:
                    self.fetch()
                    return self.click(delay, elapsed)
                except self.ElementNotFetchableError as e:
                    print(str(e))
                    return False

            else:
                f"Element reference was stale for more than {delay} seconds"
                return False
        except selenium.common.exceptions.ElementNotInteractableException:
            elapsed = elapsed + time.perf_counter()-start
            if elapsed < delay:
                time.sleep(0.1)
                ic("NotInteractable", elapsed, delay)
                return self.click(delay, elapsed)
            else:
                f"Element click was not interactable for more than {delay} seconds"
                return False
        except selenium.common.exceptions.WebDriverException:
            elapsed = elapsed + time.perf_counter()-start
            if elapsed < delay:
                time.sleep(0.1)
                ic("Unknown web driver error", elapsed, delay)
                return self.click(delay, elapsed)
            else:
                f"Unkown web driver error for more than {delay} seconds"
                return False


    def send_keys(self, text):
        return self.element.send_keys(text)

    def get_attribute(self, text):
        return self.element.get_attribute(text)

    @property
    def innerText(self):
        return self.element.get_attribute("innerText")

    @property
    def text(self):
        return self.element.text

    def find_element(self, by, selector, optional=False):
        try:
            elem = self.element.find_element(by, selector)
            new_selector = (self.selector + selector[1:]) if self.selector else None
            new_method = self.method if new_selector else None
            name = self.name + "+" + selector
            new_elem = Element(self.driver, name, self.method, new_selector, element=elem)
            return new_elem
        except selenium.common.exceptions.StaleElementReferenceException:
            if not optional:
                self.fetch()
                self.find_element(by, selector)
            else:
                raise NoSuchElementException()

    def find_elements(self, by, selector):
        elems = self.element.find_elements(by, selector)
        name = self.name + "+" + selector
        new_elems = [Element(self.driver, name, method=None, selector=None, element=i) for i in elems]                     
        return new_elems

# url = f"https://api.symbl.ai/v1/conversations/{conv_id}/entities"
# headers = {"accept": "application/json"}
# response = requests.get(url, headers=headers)

def auth():
    url = "https://api.symbl.ai/oauth2/token:generate"

    payload = {
        "type": "application",
        "appId": "6a7a35426f52716373754a7247626b4e4562477a48676248464a686a4b626c44",
        "appSecret": "4f675f567373456347574c487148734c62437067444575626358473655394963647033624f4250556451514949424b5431504f375a41303254595f486f346e67"
    }
    headers = {
        "accept": "application/json",
        "content-type": "application/json"
    }

    response = requests.post(url, json=payload, headers=headers)

    print(response.json()["accessToken"])

    access_token = response.json()["accessToken"]
    return access_token

def entities(auth_tok, conv_id):
    import requests

    url = f"https://api.symbl.ai/v1/conversations/{conv_id}/entities"

    headers = {
        "accept": "application/json",
        "authorization": f"Bearer {auth_tok}",
    }

    response = requests.get(url, headers=headers)

    data = response.json()

    simplified_dict = {}

    for entity in data['entities']:
        # Assuming each 'subType' is unique and only the first 'detectedValue' is needed
        if entity['matches']:  # Check if there are any matches to avoid errors
            simplified_dict[entity['subType']] = entity['matches'][0]['detectedValue']

    return simplified_dict

def normalize_string(s):
    # Normalize the string for comparison
    return s.lower().replace("_", " ")

def calculate_cosine_similarity(str1, str2):
    vectorizer = TfidfVectorizer().fit([str1, str2])
    vectors = vectorizer.transform([str1, str2])
    return cosine_similarity(vectors[0:1], vectors[1:2])[0][0]

def find_best_match(data_key, form_fields):
    normalized_data_key = normalize_string(data_key)
    similarities = [calculate_cosine_similarity(normalized_data_key, normalize_string(field)) for field in form_fields]
    best_match_index = np.argmax(similarities)  # Find index of best matching field
    return form_fields[best_match_index]

def form_fill(driver, data, form_fields):
    for data_key, value in data.items():
        try:
            # Find the form field that best matches the data key
            best_match_field = find_best_match(data_key, form_fields)
            # Use the best match to interact with the web page
            element = Element(driver=driver, name=best_match_field, method="CSS_SELECTOR", selector=f'[name="{best_match_field}"]')
            element.send_keys(value)
        except Element.ElementNotFetchableError:
            print(f"Could not fetch element for {data_key}.")
        except Exception as e:
            print(f"Unresolved error on {data_key}: {e}")

# Example usage:
# form_fields should be a list of the 'name' attributes of the form inputs on the web page
# data is the dictionary containing the values to fill in the form

form_fields = ['Age', 'Location', 'Occupation', 'Person_Name', 'Physical_Attribute']
# data = {'Age': '30', 'Location': 'New York', 'Occupation': 'Engineer', 'Person_Name': 'Alex', 'Physical_Attribute': 'Tall'}

# options = webdriver.ChromeOptions()
# # Optionally, add any necessary options here

# # Redirect logs to /dev/null to ignore them
# service = webdriver.chrome.service.Service(log_path='/dev/null')
# driver = webdriver.Chrome(options=options, service=service)
# driver.get("http://127.0.0.1:50913/")

input("Hit any key to begin recording!  You will have 20 seconds.")

# Parameters for recording
FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 44100
CHUNK = 1024
RECORD_SECONDS = 20  # Adjust the recording time as needed
WAVE_OUTPUT_FILENAME = "last_audio.wav"

audio = pyaudio.PyAudio()

# Start recording
stream = audio.open(format=FORMAT, channels=CHANNELS,
                    rate=RATE, input=True,
                    frames_per_buffer=CHUNK)
print("Recording...")
frames = []

for i in range(0, int(RATE / CHUNK * RECORD_SECONDS)):
    data = stream.read(CHUNK)
    frames.append(data)
print("Finished recording.")

# Stop and close the stream 
stream.stop_stream()
stream.close()
audio.terminate()

# Save the recorded data as a WAV file
wf = wave.open(WAVE_OUTPUT_FILENAME, 'wb')
wf.setnchannels(CHANNELS)
wf.setsampwidth(audio.get_sample_size(FORMAT))
wf.setframerate(RATE)
wf.writeframes(b''.join(frames))
wf.close()


# input("ready?")

# local_path = r'test_audio.m4a'
local_path = WAVE_OUTPUT_FILENAME
conversation_object = symbl.Audio.process_file(
file_path=local_path,
credentials={'app_id': '6a7a35426f52716373754a7247626b4e4562477a48676248464a686a4b626c44', 'app_secret': '4f675f567373456347574c487148734c62437067444575626358473655394963647033624f4250556451514949424b5431504f375a41303254595f486f346e67'})
conv_id = conversation_object.get_conversation_id()
print(conversation_object.get_messages())
auth1 = auth()
discoveries = entities(auth1, conv_id)
ic(discoveries)
#form_fill(driver, discoveries, form_fields)
code.interact(local=locals())