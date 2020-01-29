# Conferencing sample app for Node.js using Bandwidth WebRTC

## Setting things up

To run this sample, you'll need a Bandwidth phone number, Voice API credentials and WebRTC enabled for your account. Please check with your account manager to ensure you are provisioned for WebRTC.

This sample will need be publicly accessible to the internet in order for Bandwidth API callbacks to work properly. Otherwise you'll need a tool like [ngrok](https://ngrok.com) to provide access from Bandwidth API callbacks to localhost.

*NOTE* Unless you are running on `localhost` you will need to use HTTPS. Most modern browsers require a secure context when accessing cameras and microphones.


### Create a Bandwidth Voice API application
Follow the steps in [How to Create a Voice API Application](https://support.bandwidth.com/hc/en-us/articles/360035060934-How-to-Create-a-Voice-API-Application-V2-) to create your Voice API appliation.

In step 7 and 8, make sure they are set to POST.

In step 9, provide the publicly accessible URL of your sample app. *NOTE* You need to add `/callback` to the end of this URL in the Voice Application settings.

You do no need to set a callback user id or password. 

Create the application and make note of your _Application ID_. You will provide this in the settings below.

### Configure your sample app
Copy the default configuration files

```bash
cp .env.default .env
cp frontend/.env.default frontend/.env
```

Add your Bandwidth account settings to `.env`:

* ACCOUNT\_ID
* USERNAME
* PASSWORD

Add your Voice Application settings to `.env`:

* VOICE\_NUMBER (Bandwith phone number associated with the Voice Application in [E.164 format](https://www.bandwidth.com/glossary/e164/))
* VOICE\_APP\_ID (the Voice Application ID from above)
* VOICE\_CALLBACK\_URL (the publicly accessible URL you specified as the callback in the Voice Application. *NOTE* it should have `/callback` at the end of the URL)

You can also customize the phone number that is displayed in the frontend by modifying the `frontend/.env` file:

* `REACT_APP_PHONE_NUMBER` (display string for the dial in phone number)

### Install dependencies and build

```bash
npm install
npm start
```

### Start a conference
Browse to [http://localhost:8080](http://localhost:8080) and start a conference.

You should now be able to dial into your phone number, punch in your conference code, and be connected to your conference.