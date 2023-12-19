import React, { useState, useEffect } from "react";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer";

const fetchAndParseDiffyRequestList = async (regexPattern = null) => {
  const response = await fetch('http://user-service.diffy.svc.intra.ifit.com:8888/api/1/endpoints?exclude_noise=false');
  const diffyResponseJson = await response.json();
  const allMatchedRequests = regexPattern ? {} : diffyResponseJson;
  const allMatchedRequestsWithDiffs = {};
  let totalMatches = 0;
  let totalDiffs = 0;
  Object.keys(diffyResponseJson).forEach(key => {
    if (regexPattern) {
      if (key.match(regexPattern)) {
        allMatchedRequests[key] = diffyResponseJson[key];
        if (diffyResponseJson[key].differences === 0) totalMatches += diffyResponseJson[key].total;
        if (diffyResponseJson[key].differences > 0) {
          allMatchedRequestsWithDiffs[key] = diffyResponseJson[key];
          totalMatches += diffyResponseJson[key].total - diffyResponseJson[key].differences;
          totalDiffs += diffyResponseJson[key].differences;
        }
      }
    } else {
      if (diffyResponseJson[key].differences === 0) totalMatches += diffyResponseJson[key].total;
      if (diffyResponseJson[key].differences > 0) {
        allMatchedRequestsWithDiffs[key] = diffyResponseJson[key];
        totalMatches += diffyResponseJson[key].total - diffyResponseJson[key].differences;
        totalDiffs += diffyResponseJson[key].differences;
      }
    }
  });
  return {
    allMatchedRequests,
    allMatchedRequestsWithDiffs,
    totalMatches,
    totalDiffs,
  };
}

const MultipleRequestListButton = ({ requestPath, hasDifferences, loadHandler }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [diffyItemRequests, setDiffyItemResponse] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`http://user-service.diffy.svc.intra.ifit.com:8888/api/1/endpoints/${requestPath}/fields/response.body/results?include_weights=true&exclude_noise=false`);
        const diffyItemResponseJson = await response.json();
        const parsedDiffyItemRequests = diffyItemResponseJson.requests.map(request => {
          const { id, differences } = request;
          return {
            id,
            hasDifferences: Object.keys(differences).reduce((acc, curr) => {
              if (acc) return acc;
              return differences[curr].type !== 'NoDifference';
            }, false)
          }
        });
        setDiffyItemResponse(parsedDiffyItemRequests);
      } catch (e) {
        console.error('Error fetching data:', e);
      }
    };
    fetchData();
  }, []);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  return (
    <div>
      <button onClick={toggleExpand}>{requestPath} {hasDifferences ? '❌' : '✅'} MULTIPLE</button>
      {isExpanded && (
        <ul>
          {diffyItemRequests && diffyItemRequests.map(({ id, hasDifferences }, index) => (
            <li key={index}>
              <button onClick={() => loadHandler(requestPath, index)}>{index} {id} {hasDifferences ? '❌' : '✅'}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const DiffyRequestsList = ({ diffyResponse, loadHandler }) => {
  if (!diffyResponse || !Object.keys(diffyResponse).length) return null;

  const [showAll, setShowAll] = useState(true);

  const listStyle = {
    listStyleType: 'disc',
    margin: 0,
    padding: 0,
    textAlign: 'left',
  };
  const listItemStyle = {
    marginRight: '20px',
  };

  const { allMatchedRequests, allMatchedRequestsWithDiffs, totalMatches, totalDiffs } = diffyResponse;
  const diffyRequestsList = showAll ? allMatchedRequests : allMatchedRequestsWithDiffs;

  return (
    <div>
      <button onClick={() => setShowAll(!showAll)}>{showAll ? 'SHOW REQUEST WITH DIFFS' : 'SHOW ALL REQUESTS'}</button>
      <h3>Total Matches: {totalMatches}</h3>
      <h3>Total Diffs: {totalDiffs}</h3>
      <ul style={listStyle}>
        {Object.keys(diffyRequestsList).map((requestPath, index) => {
          const hasDifferences = diffyRequestsList[requestPath].differences > 0;
          const hasMultiple = diffyRequestsList[requestPath].total > 1;
          return (
            <li key={index} style={listItemStyle}>
              {hasMultiple
                ? (<MultipleRequestListButton
                    requestPath={requestPath}
                    hasDifferences={hasDifferences}
                    loadHandler={loadHandler}
                  />)
                : (<button onClick={() => loadHandler(requestPath, 0)}>{requestPath} {hasDifferences ? '❌' : '✅'}</button>)
              }
            </li>
          )
        })}
      </ul>
    </div>
  );
};

export default function App() {
  const [monolithBaseUrl, setMonolithBaseUrl] = useState('https://api.ifit.com');
  const [userServiceBaseUrl, setUserServiceBaseUrl] = useState('https://user-service.svc.ifit.com');
  const [requestInfoString, setRequestInfoString] = useState('');
  const [monolithResponseBody, setMonolithResponseBody] = useState('');
  const [userServiceResponseBody, setUserServiceResponseBody] = useState('');
  const [requestEndpointRegexPattern, setRequestEndpointRegexPattern] = useState('');
  const [diffyResponse, setDiffyResponse] = useState({});
  const [readyState, setReadyState] = useState(false);

  // get list of requests from diffy on page load
  useEffect(() => {
    const fetchData = async () => {
      try {
        const parsedDiffyRequestList = await fetchAndParseDiffyRequestList();
        setDiffyResponse(parsedDiffyRequestList);
      } catch (e) {
        console.error('Error fetching data:', e);
      }
    };
    fetchData();
  }, []);

  // when readyState = true, performs handleLoadClick to diff between monolith and user-service
  useEffect(() => {
    if (readyState) {
      handleLoadClick();
      setReadyState(false);
    }
  }, [readyState]);

  // get list of requests from diffy that match requestEndpointRegexPattern
  async function handleLoadMatchingDiffyList() {
    const regexPattern = new RegExp(requestEndpointRegexPattern);
    // const regexPattern = new RegExp(requestEndpointRegexPattern.replace(/^\/|\/$/g, ''));
    try {
      const parsedDiffyRequestList = await fetchAndParseDiffyRequestList(regexPattern);
      setDiffyResponse(parsedDiffyRequestList);
    } catch (e) {
      console.error('Error fetching data:', e);
    }
  }

  // takes a diffy request, gets+sets requestInfoString, and sets readyState to true to trigger fetch+diffing
  async function handleLoadDiffyRequest(requestPath, index = 0) {
    const requestsList = await fetch(`http://user-service.diffy.svc.intra.ifit.com:8888/api/1/endpoints/${requestPath}/fields/response.body/results?include_weights=true&exclude_noise=false`);
    const requestsListJson = await requestsList.json();
    const requestId = requestsListJson.requests[index].id;
    const requestDetails = await fetch(`http://user-service.diffy.svc.intra.ifit.com:8888/api/1/requests/${requestId}`);
    const requestDetailsJson = await requestDetails.json();
    const { request } = requestDetailsJson;
    const requestInfoString = JSON.stringify(request, null, 2);
    setRequestInfoString(requestInfoString);
    setReadyState(true);
  }

  // performs request to monolith and user-service & diffs responses
  async function handleLoadClick() {
    const requestInfo = JSON.parse(requestInfoString);
    const { uri, method } = requestInfo;
    console.log({ uri, method, monolithBaseUrl, userServiceBaseUrl });

    const monolithResponse = await fetch(`${monolithBaseUrl}${uri}`, requestInfo);
    const monolithResponseJson = await monolithResponse.json();
    console.log({ monolithResponseJson });
    setMonolithResponseBody(monolithResponseJson);

    const userServiceResponse = await fetch(`${userServiceBaseUrl}${uri}`, requestInfo);
    const userServiceResponseJson = await userServiceResponse.json();
    console.log({ userServiceResponseJson });
    setUserServiceResponseBody(userServiceResponseJson);
  }

  const containerStyles = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  };

  const contentsStyles = {
    width: '70%',
  };

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

      <div style={containerStyles}>
        <div style={contentsStyles}>
          <h1>Request Endpoint Regex Pattern</h1>
          <input
            type="text"
            name="requestEndpointRegexPatternInput"
            id="requestEndpointRegexPatternInput"
            value={requestEndpointRegexPattern}
            onInput={e => setRequestEndpointRegexPattern(e.target.value)}
          />
          <button onClick={handleLoadMatchingDiffyList}>Get List!</button>

          <h1>Monolith Base Url</h1>
          <input
            type="text"
            name="monolithBaseUrlInput"
            id="monolithBaseUrlInput"
            value={monolithBaseUrl}
            onInput={e => setMonolithBaseUrl(e.target.value)}>
          </input>

          <h1>User-Service Base Url</h1>
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

        <div>
          <h1>Diffy Requests</h1>
          <DiffyRequestsList
            diffyResponse={diffyResponse}
            loadHandler={handleLoadDiffyRequest}
          />
        </div>
      </div>
    </div>
  );
}
