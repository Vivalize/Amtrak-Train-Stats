const request = require('request');
const CryptoJS = require("crypto-js");

const dataUrl = 'https://maps.amtrak.com/services/MapDataService/trains/getTrainsData';
const sValue = '9a3686ac';
const iValue = 'c6eb2f7f5c4740c1a2f708fefd947d39';
const publicKey = '69af143c-e8cf-47f8-bf09-fc1f61e5cc33';
const masterSegment = 88;

// Pull the live train data and process it
request(dataUrl, {}, (err, res, rawData) => {
	if (err) { return console.log(err); }
	var trainData = getTrainData(rawData);
	
	// Do something with the data here
	printTrainData(trainData)
});

// Decrypt the data and clean it up
function getTrainData(rawData) {
	var mainContent = rawData.substring(0,rawData.length-masterSegment);
	var encryptedPrivateKey = rawData.substr(rawData.length-masterSegment,rawData.length);
	var privateKey = decrypt(encryptedPrivateKey, publicKey).split('|')[0]
	var unparsed = decrypt(mainContent,privateKey)
	var parsed = JSON.parse(unparsed).TrainsDataResponse.features;
	var cleanedData = []
	for (var i = 0; i < parsed.length; i++) {
		var trainData = {}
		trainData.coordinates = parsed[i].geometry.coordinates;
		var keys = Object.keys(parsed[i].properties)
		var stationData = {}
		for (var j = 0; j < keys.length; j++) {
			if (keys[j].startsWith('Station')) stationData[keys[j]] = parsed[i].properties[keys[j]]
			else trainData[keys[j]] = parsed[i].properties[keys[j]]
		}
		trainData.Stations = stationData
		cleanedData.push(trainData)
	}
	return cleanedData;
};

// Decrypt with CryptoJS
function decrypt(content, key) {
	return CryptoJS.AES.decrypt(
		CryptoJS.lib.CipherParams.create({ciphertext: CryptoJS.enc.Base64.parse(content)}),
		CryptoJS.PBKDF2(key, CryptoJS.enc.Hex.parse(sValue), {keySize: 4, iterations: 1e3}),
		{iv: CryptoJS.enc.Hex.parse(iValue)}
	).toString(CryptoJS.enc.Utf8)
};

// Print the data in a nice summary
function printTrainData(data) {
	for (var i = 0; i < data.length; i++) {
		var train = data[i];
		if (train.TrainState == 'Active') {
			console.log('Train',train.TrainNum,'of',train.RouteName,'is heading',train.Heading,'from',train.OrigCode,'to',train.DestCode)
		}
		else if (train.TrainState == 'Predeparture') {
			console.log('Train',train.TrainNum,'of',train.RouteName,'will depart from',train.OrigCode, 'at', train.OrigSchDep);
		}
		else if (train.TrainState == 'Completed'){
			console.log('Train',train.TrainNum,'of',train.RouteName,'has completed its trip at',train.EventCode);
		} else {
			console.log('Train',train.TrainNum,'of',train.RouteName,'is not active');
		}
	}
}