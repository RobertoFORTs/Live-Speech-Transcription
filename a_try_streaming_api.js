
import WebSocket from 'ws';
import { config } from 'dotenv';
import { v4 as uuid } from 'uuid';
import { MicrophoneHandler } from './utils/mic_handler.js'
import { AuthToken } from './utils/auth.js';

async function handleWebSocketConnection(apiUrl, mic) {
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
            mic.handleAudioStream(ws);
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
console.log('running the script')
const id = uuid();
let conversationId;
config(); //getting access to dotenv variables
const micOptions = {
  rate: 8000,
  channels: '1',
  debug: false,
  exitOnSilence: 6,
};
const micHandler = new MicrophoneHandler(micOptions);
const authToken = new AuthToken(process.env.APP_ID, process.env.APP_SECRET);
const accessToken = await authToken.getAccessToken();
const apiUrl = `wss://api.symbl.ai/v1/streaming/${id}?access_token=${accessToken}`;
console.log('starting the WebSocket requests')
handleWebSocketConnection(apiUrl, micHandler);




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

// function handleRecognitionResult(data) {
//       // Extract relevant information from the recognition result message
//       const isFinal = data.message.isFinal;
//       const alternatives = data.message.payload.raw.alternatives;
//       const punctuatedTranscript = data.message.punctuated.transcript;
//       const user = data.message.user;
  
//       // Process the recognition result based on your requirements
//       console.log('Received recognition result:');
//       console.log('Is Final:', isFinal);
//       console.log('Punctuated Transcript:', punctuatedTranscript);
//       console.log('User ID:', user.userId);
//       console.log('User Name:', user.name);
  
//       // If the result is final, you can use the punctuated transcript
//       if (isFinal) {
//         console.log('Definitive Transcript:', punctuatedTranscript);
//         setTimeout(() => {}, 2000);
//       } else {
//           // If the result is not final, you might want to consider
//           // waiting for the final result before logging the definitive transcript
//           console.log('Waiting for the final result to generate definitive transcript.');
//       }
// }
