/*
 * Copyright 2019 Amazon.com, Inc. or its affiliates.  All Rights Reserved.
 *
 * You may not use this file except in compliance with the terms and conditions 
 * set forth in the accompanying LICENSE.TXT file.
 *
 * THESE MATERIALS ARE PROVIDED ON AN "AS IS" BASIS. AMAZON SPECIFICALLY DISCLAIMS, WITH 
 * RESPECT TO THESE MATERIALS, ALL WARRANTIES, EXPRESS, IMPLIED, OR STATUTORY, INCLUDING 
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
*/

// This skill sample demonstrates how to send directives and receive events from an Echo connected gadget.
// This skill uses the Alexa Skills Kit SDK (v2). Please visit https://alexa.design/cookbook for additional
// examples on implementing slots, dialog management, session persistence, api calls, and more.

const Alexa = require('ask-sdk-core');
const Util = require('./util');
const Common = require('./common');
const document = require('./apl/template.json');


// The audio tag to include background music
const BG_MUSIC = '<audio src="soundbank://soundlibrary/ui/gameshow/amzn_ui_sfx_gameshow_waiting_loop_30s_01"/>';

// The namespace of the custom directive to be sent by this skill
const NAMESPACE = 'Custom.Mindstorms.Gadget';

// The name of the custom directive to be sent this skill
const NAME_CONTROL = 'control';

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle: async function(handlerInput) {
        console.log(" LAUNCH ");
        console.log(handlerInput.requestEnvelope);
        
        const request = handlerInput.requestEnvelope;
        const { apiEndpoint, apiAccessToken } = request.context.System;
        const apiResponse = await Util.getConnectedEndpoints(apiEndpoint, apiAccessToken);
        console.log('apiResponse: ', apiResponse);
        //const pictureUrl = Util.getS3PreSignedUrl("Media/hammerBackgroung.jpg");
        const pictureUrl = "https://www.lego.com/cdn/cs/set/assets/bltcd461a16ee553ef0/Mindstroms-Build_Bot-TRACK3R-Sidekick-Standardfa39268afb269891b21f72b189e198c6b015ff89bad95355aa044bb683546555.jpg";

        if ((apiResponse.endpoints || []).length === 0) {
            return handlerInput.responseBuilder
            .speak(`I couldn't find an EV3 Brick connected to this Echo device. Please check to make sure your EV3 Brick is connected, and try again.`)
            .addDirective({
                type : 'Alexa.Presentation.APL.RenderDocument',
                document : document,
                datasources : {
                    "data": {
                        "backgroundImage": {
                            "url": pictureUrl
                        },
                        "textContent": {
                            "primaryText": ""
                        },
                        "headerTitle": "HAMMER"
                    }
                }
            })
            .getResponse();
        }

        // Store the gadget endpointId to be used in this skill session
        const endpointId = apiResponse.endpoints[0].endpointId || [];
        Util.putSessionAttribute(handlerInput, 'endpointId', endpointId);

        // Set skill duration to 5 minutes (ten 30-seconds interval)
        Util.putSessionAttribute(handlerInput, 'duration', 10);

        // Set the token to track the event handler
        const token = handlerInput.requestEnvelope.request.requestId;
        Util.putSessionAttribute(handlerInput, 'token', token);

        let speechOutput = "Welcome, This is the voice interface to send commands to the Lego Hammer Robot. Let's ask him if he is ready. Hammer, are you listening?. <voice name='Matthew'> Yes. Ready for action. What should I do chief?. </voice>";
        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .addDirective(Util.buildStartEventHandler(token,60000, {}))
            .addDirective({
                type : 'Alexa.Presentation.APL.RenderDocument',
                document : document,
                datasources : {
                    "data": {
                        "backgroundImage": {
                            "url": pictureUrl
                        },
                        "textContent": {
                            "primaryText": ""
                        },
                        "headerTitle": "HAMMER"
                    }
                }
            })
            .getResponse();
    }
};

// Add the speed value to the session attribute.
// This allows other intent handler to use the specified speed value
// without asking the user for input.
const SetSpeedIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SetSpeedIntent';
    },
    handle: function (handlerInput) {
        console.log(" SET SPEED ");
        console.log(handlerInput.requestEnvelope);
        
        // Get speed 
        let speed = 50;
        //let speedQ = Alexa.getSlotValue(handlerInput.requestEnvelope, 'speedQ');
        let speedQ = Util.getSlotValueResolved(handlerInput.requestEnvelope.request.intent.slots, 'speedQ');
        let speechOutput = '';
        if (speedQ) {
            switch(speedQ) {
                case 'fast':
                    speed = 100;
                    break;
                case 'medium':
                    speed = 50;
                    break;
                case 'slow':
                    speed = 10;
                    break;
                default:
                    speed = 50;
            }
            speechOutput = `speed set to ${speedQ}.`;
        } else {
            speechOutput = `You need to specify a valid speed selecting between fast, medium or slow.`;
        }
        
        Util.putSessionAttribute(handlerInput, 'speed', speed);
        Util.putSessionAttribute(handlerInput, 'speedQ', speedQ);
    
        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .getResponse();
    }
};

// Construct and send a custom directive to the connected gadget with
// data from the MoveIntent.
const MoveIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'MoveIntent';
    },
    handle: function (handlerInput) {
        console.log(" MOVE ");
        console.log(handlerInput.requestEnvelope);
        
        const request = handlerInput.requestEnvelope;
        //const direction = Alexa.getSlotValue(request, 'Direction');
        const direction = Util.getSlotValueResolved(handlerInput.requestEnvelope.request.intent.slots, 'Direction');
 

        //Steps is optional, use default if not available
        const steps = Alexa.getSlotValue(request, 'steps') || "1";

        //Duration

        // Get data from session attribute
        const attributesManager = handlerInput.attributesManager;
        const speed = attributesManager.getSessionAttributes().speed || 50;
        const speedQ = attributesManager.getSessionAttributes().speedQ;
        const endpointId = attributesManager.getSessionAttributes().endpointId || [];

        let speechOutput = '';
        let directive = '';

        if (direction == "brake"){
            Util.putSessionAttribute(handlerInput, 'all', false);
            Util.putSessionAttribute(handlerInput, 'enemiesNumeber', 0);
            Util.putSessionAttribute(handlerInput, 'patrol', false);
            Util.putSessionAttribute(handlerInput, 'command', '');
        }


        // Construct the directive with the payload containing the move parameters
        directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
            {
                type: 'moveSteps',
                direction: direction,
                steps: steps,
                speed: speed
            });
        speechOutput = (direction == "brake")
            ?  "<voice name='Matthew'> Applying brake </voice>"
            : `<voice name='Matthew'> Executing movement command ${direction} ${steps} steps at ${speedQ} speed. </voice>`;

        console.log('speechOutput: ', speechOutput);
        console.log('Directive: ', JSON.stringify(directive));
        return handlerInput.responseBuilder
            .speak(speechOutput + BG_MUSIC)
            .addDirective(directive)
            .getResponse();
    }
};

// Construct and send a custom directive to the connected gadget with data from
// the SmashIntent.
const SmashIntent = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SmashIntent';
    },
    handle: function (handlerInput) {
        console.log(" SMASH ");
        console.log(handlerInput.requestEnvelope);
        
        const enemiesNumeber = Alexa.getSlotValue(handlerInput.requestEnvelope, 'enemiesNumeber');
        Util.putSessionAttribute(handlerInput, 'enemiesNumeber', enemiesNumeber);
 
        //const all = Alexa.getSlotValue(handlerInput.requestEnvelope, 'all');
        const all = Util.getSlotValueResolved(handlerInput.requestEnvelope.request.intent.slots, 'all');
        if (all == "all") {
            Util.putSessionAttribute(handlerInput, 'all', true);
        } else {
            Util.putSessionAttribute(handlerInput, 'all', false);
        }

        const attributesManager = handlerInput.attributesManager;
        let endpointId = attributesManager.getSessionAttributes().endpointId || [];
        //let speed = attributesManager.getSessionAttributes().speed || "50";
        let speechOutput = '';
        const patrol = Util.getSlotValueResolved(handlerInput.requestEnvelope.request.intent.slots, 'patrol');
        if (patrol == "patrol") {
            Util.putSessionAttribute(handlerInput, 'patrol', true);
        } else {
            Util.putSessionAttribute(handlerInput, 'patrol', false);
        }

        if ((patrol == 'patrol') || (all == 'all') || (enemiesNumber)){
            // Construct the directive with the payload containing the patrol type to start the patrol
            let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
                {
                    type: 'patrol'
                });
            Util.putSessionAttribute(handlerInput, 'command', 'patrol');
            if (enemiesNumeber == 1) {
                speechOutput = "<voice name='Matthew'>  I will find the thread, and I will eliminate it.</voice>";
            } else if (enemiesNumeber > 1) {
                speechOutput = "<voice name='Matthew'> I will find the " + enemiesNumber + " threads, and I will eliminate them. </voice>";
            } else if (all) {
                speechOutput = "<voice name='Matthew'>  I will find all threads, and I will eliminate them. </voice>";
            } else {
                speechOutput = "<voice name='Matthew'>  I will find threads, and you let me know what I should do with them. </voice>";    
            }
            console.log('speechOutput: ', speechOutput);
            console.log('Directive: ', JSON.stringify(directive));
            return handlerInput.responseBuilder
                .speak(speechOutput + BG_MUSIC)
                .addDirective(directive)
                .getResponse();
        } else {
            //In this case it is only asking to use the hammer at this time
            let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
                {
                    type: 'smash'
                });
            Util.putSessionAttribute(handlerInput, 'command', 'smash');

            let speechOutput = "<voice name='Matthew'> Hammer down!. </voice> <audio src='soundbank://soundlibrary/scifi/amzn_sfx_scifi_laser_gun_fires_large_04'/>";
            console.log('speechOutput: ', speechOutput);
            console.log('Directive: ', JSON.stringify(directive));
            return handlerInput.responseBuilder
                .speak(speechOutput, "REPLACE_ALL")
                .addDirective(directive)
                .withShouldEndSession(false)
                .getResponse();
        }

    }
};

const EventsReceivedRequestHandler = {
    // Checks for a valid token and endpoint.
    canHandle(handlerInput) {

        let { request } = handlerInput.requestEnvelope;
        console.log('Request type: ' + Alexa.getRequestType(handlerInput.requestEnvelope));
        if (request.type !== 'CustomInterfaceController.EventsReceived') return false;

        const attributesManager = handlerInput.attributesManager;
        let sessionAttributes = attributesManager.getSessionAttributes();
        let customEvent = request.events[0];


        // Validate event token
        if (sessionAttributes.token !== request.token) {
            console.log("Event token doesn't match. Ignoring this event");
            return false;
        }

        // Validate endpoint
        let requestEndpoint = customEvent.endpoint.endpointId;
        if (requestEndpoint !== sessionAttributes.endpointId) {
            console.log("Event endpoint id doesn't match. Ignoring this event");
            return false;
        }
        return true;
    },
    handle(handlerInput) {
        console.log(" EVENT ");
        console.log(handlerInput.requestEnvelope);
    
        const attributesManager = handlerInput.attributesManager;
        let customEvent = handlerInput.requestEnvelope.request.events[0];
        let payload = customEvent.payload;
        let name = customEvent.header.name;
        let enemiesNumeber = attributesManager.getSessionAttributes().enemiesNumeber || 0;
        let all = attributesManager.getSessionAttributes().all || false;
        let patrol = attributesManager.getSessionAttributes().patrol || false;
        let command = attributesManager.getSessionAttributes().command;
        let endpointId = attributesManager.getSessionAttributes().endpointId || [];
        let speed = attributesManager.getSessionAttributes().speed || "50";

        
        let speechOutput;
        if (name === 'Proximity') {
            console.log(" PROXIMITY ");
        
            if (command === 'patrol') {
                if ((all == true) || enemiesNumeber  > 0){
                    let speechOutput = "<voice name='Matthew'> Intruder detected! <audio src='soundbank://soundlibrary/scifi/amzn_sfx_scifi_laser_gun_fires_large_04'/> I have used my hammer to smash it!. </voice>";

                    // Construct the directive with the payload containing the move parameters
                    let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
                        {
                            type: 'smash'
                        });
                    Util.putSessionAttribute(handlerInput, 'command', 'smash');
                    console.log('speechOutput: ', speechOutput);
                    console.log('Directive: ', JSON.stringify(directive));
                    return handlerInput.responseBuilder
                        .speak(speechOutput, "REPLACE_ALL")
                        .addDirective(directive)
                        .withShouldEndSession(false)
                        .getResponse();

                } else {
                    let speechOutput = "<voice name='Matthew'> Intruder detected! Do you want me to eliminate it? </voice>";
                    Util.putSessionAttribute(handlerInput, 'command', 'elimination?');
                    console.log('speechOutput: ', speechOutput);
                    return handlerInput.responseBuilder
                        .speak(speechOutput, "REPLACE_ALL")
                        .withShouldEndSession(false)
                        .getResponse();
                }
            } else {
                let speechOutput = "<voice name='Matthew'> Intruder detected! Do you want me to eliminate it? </voice>";
                Util.putSessionAttribute(handlerInput, 'command', 'elimination?');
                console.log('speechOutput: ', speechOutput);
                return handlerInput.responseBuilder
                    .speak(speechOutput, "REPLACE_ALL")
                    .withShouldEndSession(false)
                    .getResponse();
            }
        
        } else if (name === 'Smash') {
            speechOutput = " Threat eliminated. ";
            if ((all) || (enemiesNumeber  > 0) || (patrol)){
                speechOutput += "<voice name='Matthew'> I am searching for more threads around. </voice> "
                if (enemiesNumeber) { 
                    enemiesNumeber = enemiesNumeber-1;
                    Util.putSessionAttribute(handlerInput, 'enemiesNumeber', enemiesNumeber);
                }
                let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
                    {
                        type: 'patrol'
                    });
                Util.putSessionAttribute(handlerInput, 'command', 'patrol');
                console.log('Directive: ', JSON.stringify(directive));
                console.log('speechOutput: ', speechOutput);
                return handlerInput.responseBuilder
                    .speak(speechOutput + BG_MUSIC, "REPLACE_ALL")
                    .addDirective(directive)
                    .getResponse();

            } else { 
            console.log('speechOutput: ', speechOutput);
            return handlerInput.responseBuilder
                .speak(speechOutput + BG_MUSIC, "REPLACE_ALL")
                .getResponse();
            }

        } else {
            speechOutput = "Event not recognized. Awaiting new command.";
            console.log('speechOutput: ', speechOutput);
            return handlerInput.responseBuilder
                .speak(speechOutput + BG_MUSIC, "REPLACE_ALL")
                .getResponse();
        }

    }
};

const ExpiredRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'CustomInterfaceController.Expired'
    },
    handle(handlerInput) {
        console.log("== Custom Event Expiration Input ==");

        console.log(" Request ");
        console.log(handlerInput.requestEnvelope);
        
        // Set the token to track the event handler
        const token = handlerInput.requestEnvelope.request.requestId;
        Util.putSessionAttribute(handlerInput, 'token', token);

        const attributesManager = handlerInput.attributesManager;
        let duration = attributesManager.getSessionAttributes().duration || 0;
        if (duration > 0) {
            Util.putSessionAttribute(handlerInput, 'duration', --duration);

            // Extends skill session
            const speechOutput = `${duration} minutes remaining.`;
            return handlerInput.responseBuilder
                .addDirective(Util.buildStartEventHandler(token, 60000, {}))
                .speak(speechOutput + BG_MUSIC)
                .getResponse();
        }
        else {
            // End skill session
            return handlerInput.responseBuilder
                .speak("Skill duration expired. Goodbye.")
                .withShouldEndSession(true)
                .getResponse();
        }
    }
};

const YesNoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent');
    },
    handle(handlerInput) {
        console.log(" Request ");
        console.log(handlerInput.requestEnvelope);

        const attributesManager = handlerInput.attributesManager;
        let command = attributesManager.getSessionAttributes().command;
        let endpointId = attributesManager.getSessionAttributes().endpointId || [];
        let speed = attributesManager.getSessionAttributes().speed || "50";

        let response = Alexa.getIntentName(handlerInput.requestEnvelope) 
        if (command === 'elimination?') {
            if (response === 'AMAZON.YesIntent') {

                let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
                    {
                        type: 'smash'
                    });
                Util.putSessionAttribute(handlerInput, 'command', 'smash');

                let speechOutput = "<voice name='Matthew'> ok! I am using my hammer to smash it!. </voice> ";
                console.log('speechOutput: ', speechOutput);
                console.log('Directive: ', JSON.stringify(directive));
                return handlerInput.responseBuilder
                    .speak(speechOutput, "REPLACE_ALL")
                    .addDirective(directive)
                    .withShouldEndSession(false)
                    .getResponse();
            } else {
                let directive = Util.build(endpointId, NAMESPACE, NAME_CONTROL,
                    {
                        type: 'moveSteps',
                        direction: 'backwards',
                        steps: 3,
                        speed: 50
                    });
                    let speechOutput = "<voice name='Matthew'> ok! I will then leave the target alive. Please, leave the zone! </voice>";

                    Util.putSessionAttribute(handlerInput, 'command', '');
                    console.log('speechOutput: ', speechOutput);
                    console.log('Directive: ', JSON.stringify(directive));
                    return handlerInput.responseBuilder
                        .speak(speechOutput, "REPLACE_ALL")
                        .addDirective(directive)
                        .withShouldEndSession(false)
                        .getResponse();
            }
        } else {
            const speakOutput = 'I did not get what you mean. Could you repeat again?';
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .getResponse();
        }


    }
};

// The SkillBuilder acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        SetSpeedIntentHandler,
        SmashIntent,

        MoveIntentHandler,
        EventsReceivedRequestHandler,
        ExpiredRequestHandler,
        YesNoIntentHandler,
        Common.HelpIntentHandler,
        Common.CancelAndStopIntentHandler,
        Common.SessionEndedRequestHandler,
        Common.IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .addRequestInterceptors(Common.RequestInterceptor)
    .addErrorHandlers(
        Common.ErrorHandler,
    )
    .lambda();

