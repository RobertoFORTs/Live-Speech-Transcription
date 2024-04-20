import fetch from 'node-fetch'
import { v4 as uuid } from 'uuid';
import WebSocket from 'ws';
import mic from 'mic';


const id = uuid();
const appId = '6a7a35426f52716373754a7247626b4e4562477a48676248464a686a4b626c44'
const appSecret = '4f675f567373456347574c487148734c62437067444575626358473655394963647033624f4250556451514949424b5431504f375a41303254595f486f346e67'
let conversationId;
console.log('running the script')
async function getAccessToken() {
  const fetchResponse = await fetch('https://api.symbl.ai/oauth2/token:generate', {
    method: 'post',
    headers: {
      'Content-Type': "application/json",
    },
    body: JSON.stringify({
      type: 'application',
      appId: appId,
      appSecret: appSecret
    })
  });
  const responseBody = await fetchResponse.json();
  const accessToken = responseBody['accessToken'];
  return accessToken;
}

function handle_mic(ws) {
  const micInstance = mic({
    rate: 16000,
    channels: '1',
    debug: false,
    exitOnSilence: 6,
  });

  const micInputStream = micInstance.getAudioStream();

  micInputStream.on('data', (audioChunk) => {
    const chunkSize = 8192; // Size of chunk to be sent
    // Assuming audioChunk is already a Buffer, no need to convert from hex
    const rawData = audioChunk;
    for (let i = 0; i < rawData.length; i += chunkSize) {
      const end = Math.min(i + chunkSize, rawData.length);
      const chunk = rawData.slice(i, end);
      ws.send(chunk, { binary: true }); // Sending each chunk over WebSocket
    }
  });
  micInstance.start();

  micInputStream.on('error', function (err) {
    console.error('Error in Input Stream:', err);
  });

  micInputStream.on('startComplete', function () {
    console.log('Started listening to Microphone.');
  });

  micInputStream.on('silence', function () {
    console.log('Got SIGNAL silence');
  });
}

function handleRecognitionResult(data) {
      // Extract relevant information from the recognition result message
      const isFinal = data.message.isFinal;
      const alternatives = data.message.payload.raw.alternatives;
      const punctuatedTranscript = data.message.punctuated.transcript;
      const user = data.message.user;
  
      // Process the recognition result based on your requirements
      console.log('Received recognition result:');
      console.log('Is Final:', isFinal);
      console.log('Punctuated Transcript:', punctuatedTranscript);
      console.log('User ID:', user.userId);
      console.log('User Name:', user.name);
  
      // If the result is final, you can use the punctuated transcript
      if (isFinal) {
        console.log('Definitive Transcript:', punctuatedTranscript);
        setTimeout(() => {}, 2000);
      } else {
          // If the result is not final, you might want to consider
          // waiting for the final result before logging the definitive transcript
          console.log('Waiting for the final result to generate definitive transcript.');
      }
}

async function sendStartRequest(apiUrl) {
    try {
      const ws = new WebSocket(apiUrl);

      ws.on('open', () => {
          console.log('WebSocket connection established.');
          
          // Construct the start_request message
          const startRequest = {
              type: 'start_request',
              config: {
                  confidenceThreshold: 0.7,
                  detectEntities: false,
                  languageCode: 'en-US',
                  meetingTitle: 'My Test Meeting',
                  sentiment: false,
                  speechRecognition: {
                      encoding: 'LINEAR16',
                      sampleRateHertz: 16000
                }
                //customVocabulary Array Of really different vocabulary, like company specific things
                //disconnectOnStopRequest enables resume and start options --  gotta check that out
                //disconnectOnStopRequestTimeout defines timout for closing the webSocket (default is also max 30min)
                //insightTypes can be either question or action_item -- Its an array of strings
                //noConnectionTimeout makes the webSocket be open for the time passed
                //speaker speaker name and id object 
                //trackers is an optional object to enable trackers, if not defined, there is a default config
                //actions as sendSummary by email (The only action supported)
              },
          };
          
        // Send the start_request message as JSON string
        ws.send(JSON.stringify(startRequest));
        // Check How to Handle and Send the Stop Request effectively
      });

      ws.on('message', (event) => {
        // Handle received messages
        const data = JSON.parse(event);
        if (data.type == 'message') {
          if (data && data.message.type == 'started_listening') {
            console.log("Started Listening")
            console.log('Message received:', event);
          }
          else if (data &&data.message.type == 'conversation_created') {
            //This means I will finally have a conversationId
            console.log("Conversation created")
            conversationId = data.message.data.conversationId;
          }
          else if (data && data.message.type == 'recognition_started') {
            console.log("Recognition Started. Ready to Process Audio!!!!")
            // Here I will be handling the audio transforming to binaries(chunks) to send it to the websocket
            // It keeps waiting on this stage until we send an audio or it times out (check this further)
            handle_mic(ws);
            // ws.send(JSON.stringify(data));
          }
          else if (data && data.message.type == 'recognition_result') {
            console.log("This Is the Result of the Recognition")
            console.log(data.message);
            // Handling Multiple Results of recognitions until I get a meaningful message!!
            // handleRecognitionResult(data);
          }
          else if (data && data.message.type == 'recognition_stopped') {
            console.log("Recognition Stopped. The Stop Request Was Triggered!!");
          }
          else if (data && data.message.type == 'conversation_completed') {
            console.log("Last message from API. Real-time conversation closed!!");
          }
        }
        else if (data.type == 'message_response') {
          console.log("Final Transcript for a Message!!");
          data.messages.forEach((message) => {
            console.log(message.payload.content);
          });
          //here handles the printing probably 
        }
        
      });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    } catch (error) {
        console.error('Error:', error);
    }
}

//I RUN EVERYTHING HERE

const accessToken = await getAccessToken();
const apiUrl = `wss://api.symbl.ai/v1/streaming/${id}?access_token=${accessToken}`;
console.log('starting the WebSocket requests')
sendStartRequest(apiUrl);




// USE FOR OTHER APIs REQUESTS
// const response_streaming_body =
//   axios.post(apiUrl, requestBody)
// .then(response => {
//   console.log('Response Successfull');
//   // Handle response data as needed
// })
// .catch(error => {
//   console.error('Error:', error);
//   // Handle error as needed
// });

// console.log(response_streaming_body)

/* THIS REFERS TO SDK API WAY OF CONNECTING*/
// import sdk from '@api/symblai';
// sdk.connectToSipPstn({
//   operation: 'start',
//   data: {
//     session: {location: {timeZone: {offset: 0}}}
//   },
//   intents: [{intent: 'answering_machine'}],
//   callbackUrl: 'https://webhook.yourdomain.com/2328179',
//   actions: [{invokeOn: 'start'}]
// }, {connect: ':connect'})
//   .then(({ data }) => console.log(data))
//   .catch(err => console.error(err));