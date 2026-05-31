const https = require('https');
const http = require('http');
 
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyBljnpIvBqjpyG8IMmhh8tBapWXbxWSpGhXHdsZm-UMT0VwnivjzbX0YRbZR0SqQcODg/exec';
 
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
 
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
 
  try {
    if (req.method === 'GET') {
      const params = new URLSearchParams(req.query).toString();
      const url = SCRIPT_URL + (params ? '?' + params : '');
      const response = await fetch(url);
      const data = await response.json();
      res.status(200).json(data);
 
    } else if (req.method === 'POST') {
      const body = req.body;
      const response = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json();
      res.status(200).json(data);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
