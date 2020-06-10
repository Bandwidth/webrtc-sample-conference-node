# Conferencing sample app for Node.js using Bandwidth WebRTC

To run this sample, you'll need a Bandwidth phone number, Voice API credentials and WebRTC enabled for your account. Please check with your Bandwidth Account Manager to ensure you are provisioned for WebRTC.

This sample will need to be publicly accessible to the internet in order for Bandwidth API callbacks to work properly. Otherwise you'll need a tool like [ngrok](https://ngrok.com) to provide access from Bandwidth API callbacks to localhost.

**Unless you are running on `localhost`, you will need to use HTTPS**. Most modern browsers require a secure context when accessing cameras and microphones.

Note that this sample currently works best in Chrome.

## Create a Bandwidth Voice API application

Follow the steps in [How to Create a Voice API Application](https://support.bandwidth.com/hc/en-us/articles/360035060934-How-to-Create-a-Voice-API-Application-V2) to create your Voice API appliation.

In steps 7 and 8, make sure they are set to POST.

In step 9, provide the publicly accessible URL of your sample app. You need to add `/callback` to the end of this URL in the Voice Application settings.

You do no need to set a callback user ID or password. 

Create the application and make note of your _Application ID_. You will provide this in the settings below.

## Pull the source for this sample app

This git repo uses a submodule for the /frontend code, so when you clone this repo, please make sure you use the --recursive flag, like this, (from a bash terminal):
```bash
$ git clone --recursive https://github.com/Bandwidth/webrtc-sample-conference-node.git  
```

Then go into your new repo directory:
```bash
$ cd webrtc-sample-conference-node
```

## Configure your sample app

Copy the default configuration file to make your own configuration file for the required environment variables:
```bash
cp .env.default .env
```

Add your Bandwidth account settings to `.env`:

* ACCOUNT\_ID
* USERNAME
* PASSWORD

Add your Voice Application settings to `.env`:

* VOICE\_NUMBER (Bandwith phone number associated with the Voice Application in [E.164 format](https://www.bandwidth.com/glossary/e164/))
* VOICE\_APP\_ID (the Voice Application ID from above)
* VOICE\_CALLBACK\_URL (the publicly accessible URL you specified as the callback in the Voice Application. It should have `/callback` at the end of the URL)

## Install dependencies and build

```bash
npm install
npm start
```

### Start a conference
Browse to [http://localhost:3000](http://localhost:3000) and start a conference.

(Note: If you want to use a different port number, add a PORT={port number you want to use} to your .env file or otherwise as an environement variable.)

You should now be able to dial into your phone number, punch in your conference code, and be connected to your conference.