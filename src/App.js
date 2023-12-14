import React, { useState } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer";

export default function App() {
  const [monolithBaseUrl, setMonolithBaseUrl] = useState('https://api.ifit.com');
  const [userServiceBaseUrl, setUserServiceBaseUrl] = useState('https://user-service.svc.ifit.com');
  const [requestInfoString, setRequestInfoString] = useState('');
  const [monolithResponseBody, setMonolithResponseBody] = useState('');
  const [userServiceResponseBody, setUserServiceResponseBody] = useState('');

  async function handleLoadClick() {
    const requestInfo = JSON.parse(requestInfoString);
    const { uri, method } = requestInfo;
    console.log({ uri, method, monolithBaseUrl, userServiceBaseUrl });

    const monolithResponse = await fetch(`${monolithBaseUrl}${uri}`, requestInfo);
    const monolithResponseJson = await monolithResponse.json();
    console.log({monolithResponseJson});
    setMonolithResponseBody(monolithResponseJson);

    const userServiceResponse = await fetch(`${userServiceBaseUrl}${uri}`, requestInfo);
    const userServiceResponseJson = await userServiceResponse.json();
    console.log({userServiceResponseJson});
    setUserServiceResponseBody(userServiceResponseJson);
  }

  const newStyles = {
    variables: {
      light: {
        codeFoldGutterBackground: "#6F767E",
        codeFoldBackground: "#E2E4E5"
      }
    }
  };

  const textAreaStyles = {
    width: "100%",
    height: "350px",
    maxWidth: "100%",
    minWidth: "100%",
  };

  return (
    <div>
      <h1>Juxtapose</h1>

      <h1>Monolith Base Url</h1>
      <input
        type="text"
        name="monolithBaseUrlInput"
        id="monolithBaseUrlInput"
        value={monolithBaseUrl}
        onInput={e => setMonolithBaseUrl(e.target.value)}>
      </input>

      <h1>user-service Base Url</h1>
      <input
        type="text"
        name="userServiceBaseUrlInput"
        id="userServiceBaseUrlInput"
        value={userServiceBaseUrl}
        onInput={e => setUserServiceBaseUrl(e.target.value)}>
      </input>

      <h1>Diffy Info</h1>
      <textarea
        name="requestInfoTextArea"
        id="requestInfoTextArea"
        type="text"
        style={textAreaStyles}
        value={requestInfoString}
        onInput={e => setRequestInfoString(e.target.value)}
        >
      </textarea>
      <button onClick={handleLoadClick}>Load!</button>
      <div className="App">
        <ReactDiffViewer
          oldValue={JSON.stringify(monolithResponseBody, null, 4)}
          newValue={JSON.stringify(userServiceResponseBody, null, 4)}
          splitView={true}
          compareMethod={DiffMethod.WORDS}
          styles={newStyles}
          leftTitle="Monolith"
          rightTitle="user-service"
        />
      </div>
    </div>
  );
}
