# toornement-quick-schedule
A small program to update match starting time at toornament.com with set intervals.

## Getting started
Install dependencies:
```
npm install
```

Then, create credentials.json:
```json
{
    "api_key": "XXXXX",
    "client_id": "XXXXX",
    "client_secret": "XXXXX"
}
```

## Usage
Run program using 
```
node app.js [tournament name] [first start time]
```
Example:
```
node app.js 'MyTestTournament' '2017-10-06 12:00:00'
```
