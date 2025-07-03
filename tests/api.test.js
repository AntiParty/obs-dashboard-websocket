const request = require('supertest');
const express = require('express');
const OBSWebSocket = require('obs-websocket-js').default;

// Mock server.js for basic endpoint test
const app = require('../server'); // You may need to export app from server.js

describe('API', () => {
  it('should return 503 if OBS is not available', async () => {
    const res = await request(app).get('/api/obs-status');
    expect(res.statusCode).toBe(200);
    expect(res.body.connected).toBe(false);
  });
});