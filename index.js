
import WebSocket from 'ws';
import pkg from '@symblai/symbl-js'
import { v4 as uuid } from 'uuid';
import mic from 'mic';
const { sdk, SpeakerEvent } = pkg;
// For demo purposes, we're using mic to simply get audio from the microphone and pass it on to the WebSocket connection

const sampleRateHertz = 16000
const appId = '6a7a35426f52716373754a7247626b4e4562477a48676248464a686a4b626c44'
const appSecret = '4f675f567373456347574c487148734c62437067444575626358473655394963647033624f4250556451514949424b5431504f375a41303254595f486f346e67'
const micInstance = mic({
  rate: sampleRateHertz,
  channels: '1',
  debug: false,
  exitOnSilence: 6,
});
// //adding speakerEvent
// const speakerEvent = new SpeakerEvent();
// speakerEvent.type = SpeakerEvent.types.startedSpeaking;
// speakerEvent.user = {
//   userId: 'john@example.com',
//   name: 'John'
// };
// speakerEvent.timestamp = new Date().toISOString();
// alt + shift + s to uncomment - have to set on vscode commands
(async () => {
  try {
    //Get Access token
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
    // Initialize the SDK
    await sdk.init({
      appId: appId,
      appSecret: appSecret,
      basePath: 'https://api.symbl.ai',
    }).then(() => {
      console.log("Sdk Initiated Successfully")
    })
    const id = uuid();
    // Start Real-time Request (Uses Real-time WebSocket API behind the scenes)
    const connection = await sdk.startRealtimeRequest({
      id,
      insightTypes: ['action_item', 'question'],
      config: {
        meetingTitle: 'My Test Meeting',
        confidenceThreshold: 0.7,
        timezoneOffset: 480, // Offset in minutes from UTC
        languageCode: 'en-US',
        sampleRateHertz
      },
      speaker: {
        // Optional, if not specified, will simply not send an email in the end.
        userId: 'emailAddress', // Update with valid email
        name: 'My name'
      },
      handlers: {
        /**
         * This will return live speech-to-text transcription of the call.
         */
        onSpeechDetected: (data) => {
          if (data) {
            const {punctuated} = data
            console.log('Live: ', punctuated && punctuated.transcript)
            console.log('');
          }
          console.log('onSpeechDetected ', JSON.stringify(data, null, 2));
        },
        /**
         * When processed messages are available, this callback will be called.
         */
        onMessageResponse: (data) => {
          console.log('onMessageResponse', JSON.stringify(data, null, 2))
        },
        /**
         * When Symbl detects an insight, this callback will be called.
         */
        onInsightResponse: (data) => {
          console.log('onInsightResponse', JSON.stringify(data, null, 2))
        },
        /**
         * When Symbl detects a topic, this callback will be called.
         */
        onTopicResponse: (data) => {
          console.log('onTopicResponse', JSON.stringify(data, null, 2))
        }
      }
    })
    console.log('Connection started.', connection.conversationId);
          // Need unique Id
    //const id = uuid()
    const connectionId = connection.connectionId;
    // getting accessToken from the fetchResponse
    const accessToken = responseBody['accessToken'];
    console.log('Openning Websocket')
    //defining symbl endpoint
    const symblEndPoint = `wss://api.symbl.ai/v1/subscribe/${connectionId}?access_token=${accessToken}`;
    const ws = new WebSocket(symblEndPoint);
    console.log('Subscribing to connection')
    // The api docs call this as subscribeToStream
    // Fired when a message is received from the WebSocket server
    ws.onmessage = (event) => {
      // You can find the conversationId in event.message.data.conversationId;
      const data = JSON.parse(event.data);
      if (data.type === 'message' && data.message.hasOwnProperty('data')) {
          console.log('conversationId', data.message.data.conversationId);
      }
      if (data.type === 'message_response') {
          for (let message of data.messages) {
              console.log('Transcript (more accurate): ', message.payload.content);
          }
      }
      if (data.type === 'topic_response') {
          for (let topic of data.topics) {
              console.log('Topic detected: ', topic.phrases)
          }
      }
      if (data.type === 'insight_response') {
          for (let insight of data.insights) {
              console.log('Insight detected: ', insight.payload.content);
          }
      }
      if (data.type === 'message' && data.message.hasOwnProperty('punctuated')) {
          console.log('Live transcript (less accurate): ', data.message.punctuated.transcript)
      }
      console.log(`Response type: ${data.type}. Object: `, data);
    };
    // Fired when the WebSocket closes unexpectedly due to an error or lost connection
    ws.onerror = (err) => {
      console.error(err);
    };

    // Fired when the WebSocket connection has been closed
    ws.onclose = (event) => {
      console.info('Connection to websocket closed');
    };

    // //---> This Might be used for SIP connections to real websites or apps convos
    // sdk.startEndpoint({
    //   endpoint: {
    //     type: 'sip',
    //     dtmf: "<meeting_id>#,#<password>#" // if password protected, use "dtmf": "<meeting_id>#,#<password>#"
    //   }
    // });

    // 
    const micInputStream = micInstance.getAudioStream()
    /** Raw audio stream */
    micInputStream.on('data', (data) => {
      // Push audio from Microphone to websocket connection
      connection.sendAudio(data)
    })

    micInputStream.on('error', function (err) {
      console.log('Error in Input Stream: ' + err)
    })

    micInputStream.on('startComplete', function () {
      console.log('Started listening to Microphone.')
    })

    micInputStream.on('silence', function () {
      console.log('Got SIGNAL silence')
    })

    micInstance.start()

    setTimeout(async () => {
      // Stop listening to microphone
      micInstance.stop()
      console.log('Stopped listening to Microphone.')
      try {
        // Stop connection
        await connection.stop()
        console.log('Connection Stopped.')
      } catch (e) {
        console.error('Error while stopping the connection.', e)
      }
    }, 60 * 1000) // Stop connection after 1 minute i.e. 60 secs
    } catch (err) {
      console.error('Error: ', err)
    }
})();

// .then((connection) => {
//   sdk.pushEventOnConnection(
//     connectionId,
//     speakerEvent.toJSON(),
//     (err) => {
//       if (err) {
//         console.error('Error during push event.', err);
//       } else {
//         console.log('Event pushed!');
//       }
//     }
//   );
// });


//Might be useful later

