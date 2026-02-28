# Repo Checker API

An API tool to check if dependecies and devDependencies listed in the package.json files on a github repository actually exist on the NPM registry.

## Installation and Running in Dev Mode

```bash
npm install
npm i nodemon --dev
npm run dev
```

## Usage

To use this tool, you would need to provide a _github repository url_ via the **_url_** parameter in the request body via a **POST** request to the **_/analyze_** endpoint.

### Basic Example

Here is an example with [axios](https://www.axios.com):

```javascript
const apiUrl = BASE_DOMAIN + "/analyze";
const body = {
  url: "https://github.com/polybotics-tech/doc-inbox", //--github repo url
};
const config = {
  headers: {
    "Content-Type": "application/json",
  },
};

const res = await axios.post(apiUrl, body, config);
```

### Showing Packages Found in Repository

If you wish to see the complete list of packages (and their versions) foud in the **package.json** files from the repository, you just need to set the **_listPackages_** parameter to true in your request.

Here is how this would look like when done with [axios](https://www.axios.com):

```javascript
const apiUrl = BASE_DOMAIN + "/analyze";
const body = {
  url: "https://github.com/polybotics-tech/doc-inbox", //--github repo url
  listPackages: true,
};
const config = {
  headers: {
    "Content-Type": "application/json",
  },
};

const res = await axios.post(apiUrl, body, config);

console.log("packages: ", res.data.packages); // returns an array of object {path: string, dependecies: {name, version}[], devDependencies: {name, version}[]}
```
