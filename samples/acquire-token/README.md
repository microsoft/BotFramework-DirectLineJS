---
page_type: sample
languages:
- javascript
products:
- nodejs
- ms-graph
- azure-active-directory
description: "Demonstrates how to use MSAL Node to acquire an access token for a protected resource such as Microsoft Graph in a console application using the application's own identity (client credentials flow)"
urlFragment: "ms-identity-javascript-nodejs-console"
---

# A Node.js console application secured by MSAL Node (Preview) on Microsoft identity platform

This sample demonstrates how to use [MSAL Node](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-node) to acquire an access token for a protected resource such as Microsoft Graph in a console application using the application's own identity with the ([client credentials flow](https://docs.microsoft.com/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow)).

## Features

This sample demonstrates the following **MSAL Node** concepts:

* Configuration
* Acquiring an access token
* Calling a web API

## Contents

| File/folder           | Description                                                  |
|-----------------------|--------------------------------------------------------------|
| `AppCreationScripts/` | Contains Powershell scripts for automating app registration. |
| `bin/index.js`        | Application entry.                                           |
| `bin/auth.js`         | Main authentication logic resides here.                      |
| `bin/fetch.js`        | Contains an Axios HTTP client for calling endpoints.         |
| `.env`                | Environment variables of authentication parameters.          |

## Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/en/) must be installed to run this sample.
* [Visual Studio Code](https://code.visualstudio.com/download) is recommended for running and editing this sample.

### Setup

1. [Register a new application](https://docs.microsoft.com/azure/active-directory/develop/scenario-daemon-app-registration) in the [Azure Portal](https://portal.azure.com).
    1. For API Permissions, select `User.Read.All` under **Microsoft APIs** > **Microsoft Graph** > **Application Permissions**.
    2. Select **Grant admin consent for {tenant}**.
1. Clone this repository `git clone https://github.com/Azure-Samples/ms-identity-javascript-nodejs-console.git`
1. Open the [.env](.env) file and provide the required configuration values.
    1. Replace the string `Enter_the_Tenant_Info_Here` with your tenant ID on Azure AD portal.
    2. Replace the string `Enter_the_Application_Id_Here` with your app/client ID on Azure AD portal.
    3. Replace the string `Enter_the_Client_Secret_Here` with the client secret you created on Azure AD portal.
    4. Replace the string `Enter_the_Cloud_Instance_Id_Here` with `https://login.microsoftonline.com/` (see **note** below).
    5. Replace the string `Enter_the_Graph_Endpoint_Here`. with `https://graph.microsoft.com/` (see **note** below).

> :information_source: *note*: This is for multi-tenant applications located on the global Azure cloud. For more information, see: [Use MSAL in a national cloud environment](https://docs.microsoft.com/azure/active-directory/develop/quickstart-v2-javascript-auth-code)

> :information_source: *note*: This is for MS Graph instance located on the global Azure cloud. For more information, see: [Use Microsoft Graph in a national cloud environment](https://docs.microsoft.com/graph/deployments)

1. On the command line, navigate to the root of the repository, and type `npm install`.

> :information_source: Alternative, type `npm install -g`. This will install the CLI application globally so that it can be called from anywhere.

## Run the sample

1. On the command line, navigate to the root of the repository and run the sample application with `node . --op getUsers`.

> :information_source: If you have installed the sample app globally above, type `msal-node-cli --op getUsers` from anywhere in a command line.

## Contributing

If you'd like to contribute to this sample, see [CONTRIBUTING.MD](./CONTRIBUTING.md).

## Code of Conduct

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/).
For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or
contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
