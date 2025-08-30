# AI Terminal Security & Authentication

## Security Overview

AI Terminal implements multiple layers of security to protect user data, API endpoints, and system resources. This document covers authentication mechanisms, security best practices, and compliance considerations.

## Authentication System

### JWT-Based Authentication

AI Terminal uses JSON Web Tokens (JWT) for stateless authentication.

#### Token Structure

```javascript
// JWT Payload Structure
{
  "userId": "user_unique_id",
  "username": "user_name",
  "role": "user|admin",
  "permissions": ["read", "write", "execute"],
  "iat": 1234567890,  // Issued at
  "exp": 1234654290   // Expiration time
}
```

#### Token Generation

```javascript
// Token generation implementation
const jwt = require('jsonwebtoken');

function generateToken(user) {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    permissions: user.permissions
  };
  
  const options = {
    expiresIn: '24h',
    issuer: 'ai-terminal',
    audience: 'ai-terminal-api'
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, options);
}
```

#### Token Validation

```javascript
// Middleware for token validation
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      code: 401,
      success: false,
      message: 'Access token required'
    });
  }
  
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    req.user = user;
    next();
  });
}
```

### User Management

#### User Model

```javascript
// User schema
{
  "id": "string",
  "username": "string",
  "email": "string",
  "passwordHash": "string",
  "role": "user|admin",
  "permissions": ["array"],
  "createdAt": "timestamp",
  "lastLogin": "timestamp",
  "isActive": "boolean",
  "metadata": {
    "apiKeys": ["array"],
    "workspace": "string",
    "quota": "object"
  }
}
```

#### Password Security

```javascript
// Password hashing with bcrypt
const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;

async function hashPassword(password) {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

// Password strength requirements
const passwordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  preventCommon: true
};
```

### Multi-Factor Authentication (MFA)

#### TOTP Implementation

```javascript
// Time-based One-Time Password
const speakeasy = require('speakeasy');

// Generate secret for user
function generateMFASecret(user) {
  const secret = speakeasy.generateSecret({
    name: `AI Terminal (${user.username})`,
    issuer: 'AI Terminal',
    length: 32
  });
  
  return {
    secret: secret.base32,
    qrCode: secret.otpauth_url
  };
}

// Verify TOTP token
function verifyTOTP(token, secret) {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2
  });
}
```

### Session Management

```javascript
// Session configuration
const session = require('express-session');
const RedisStore = require('connect-redis')(session);

app.use(session({
  store: new RedisStore({
    client: redisClient,
    ttl: 86400
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true, // HTTPS only
    httpOnly: true,
    maxAge: 86400000, // 24 hours
    sameSite: 'strict'
  }
}));
```

## API Security

### Rate Limiting

```javascript
// Rate limiting implementation
const rateLimit = require('express-rate-limit');

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP'
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true
});

// AI generation limiter
const generationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (req) => req.user?.id || req.ip
});

app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/generate/', generationLimiter);
```

### Input Validation

```javascript
// Input validation middleware
const { body, validationResult } = require('express-validator');

const validateCardGeneration = [
  body('topic')
    .trim()
    .isLength({ min: 1, max: 500 })
    .escape()
    .withMessage('Topic must be between 1 and 500 characters'),
  
  body('templateName')
    .optional()
    .isAlphanumeric('en-US', { ignore: '-_' })
    .withMessage('Invalid template name'),
  
  body('style')
    .optional()
    .isJSON()
    .withMessage('Style must be valid JSON'),
  
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
];
```

### SQL Injection Prevention

```javascript
// Parameterized queries
const { Pool } = require('pg');
const pool = new Pool();

async function getUserById(userId) {
  const query = 'SELECT * FROM users WHERE id = $1';
  const values = [userId];
  
  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (err) {
    console.error('Database error:', err);
    throw err;
  }
}

// ORM with built-in protection
const { Sequelize, DataTypes } = require('sequelize');

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isAlphanumeric: true,
      len: [3, 30]
    }
  }
});
```

### XSS Protection

```javascript
// Content Security Policy
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self' data:; " +
    "connect-src 'self' wss: https:;"
  );
  next();
});

// HTML sanitization
const DOMPurify = require('isomorphic-dompurify');

function sanitizeHTML(dirty) {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel']
  });
}
```

## Data Protection

### Encryption at Rest

```javascript
// File encryption
const crypto = require('crypto');

class FileEncryption {
  constructor(key) {
    this.algorithm = 'aes-256-gcm';
    this.key = Buffer.from(key, 'hex');
  }
  
  encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  decrypt(encryptedData) {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}
```

### Encryption in Transit

```javascript
// HTTPS configuration
const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('private-key.pem'),
  cert: fs.readFileSync('certificate.pem'),
  ca: fs.readFileSync('ca-certificate.pem'),
  
  // Security options
  secureProtocol: 'TLSv1_2_method',
  ciphers: [
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-SHA256',
    'ECDHE-RSA-AES256-SHA384'
  ].join(':'),
  honorCipherOrder: true
};

https.createServer(options, app).listen(443);
```

### API Key Management

```javascript
// API key generation and validation
class APIKeyManager {
  generateAPIKey() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  async hashAPIKey(apiKey) {
    return crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');
  }
  
  async validateAPIKey(apiKey) {
    const hashedKey = await this.hashAPIKey(apiKey);
    
    // Check against database
    const keyRecord = await db.query(
      'SELECT * FROM api_keys WHERE key_hash = $1 AND active = true',
      [hashedKey]
    );
    
    if (!keyRecord) {
      return false;
    }
    
    // Update last used timestamp
    await db.query(
      'UPDATE api_keys SET last_used = NOW() WHERE id = $1',
      [keyRecord.id]
    );
    
    return keyRecord;
  }
}
```

## Access Control

### Role-Based Access Control (RBAC)

```javascript
// RBAC implementation
const roles = {
  admin: {
    permissions: ['read', 'write', 'delete', 'admin'],
    inherits: ['user']
  },
  user: {
    permissions: ['read', 'write'],
    inherits: ['guest']
  },
  guest: {
    permissions: ['read'],
    inherits: []
  }
};

function hasPermission(user, permission) {
  const userRole = roles[user.role];
  if (!userRole) return false;
  
  // Check direct permissions
  if (userRole.permissions.includes(permission)) {
    return true;
  }
  
  // Check inherited permissions
  for (const inheritedRole of userRole.inherits) {
    if (hasPermission({ role: inheritedRole }, permission)) {
      return true;
    }
  }
  
  return false;
}

// Middleware for permission checking
function requirePermission(permission) {
  return (req, res, next) => {
    if (!hasPermission(req.user, permission)) {
      return res.status(403).json({
        code: 403,
        success: false,
        message: 'Insufficient permissions'
      });
    }
    next();
  };
}
```

### Resource-Level Security

```javascript
// Check resource ownership
async function checkResourceOwnership(userId, resourceId, resourceType) {
  const query = `
    SELECT owner_id 
    FROM ${resourceType}_resources 
    WHERE id = $1
  `;
  
  const result = await db.query(query, [resourceId]);
  
  if (!result.rows[0]) {
    throw new Error('Resource not found');
  }
  
  return result.rows[0].owner_id === userId;
}

// Middleware for resource access
function requireResourceAccess(resourceType) {
  return async (req, res, next) => {
    const resourceId = req.params.id;
    const userId = req.user.id;
    
    try {
      const hasAccess = await checkResourceOwnership(
        userId, 
        resourceId, 
        resourceType
      );
      
      if (!hasAccess && req.user.role !== 'admin') {
        return res.status(403).json({
          code: 403,
          success: false,
          message: 'Access denied to this resource'
        });
      }
      
      next();
    } catch (error) {
      return res.status(404).json({
        code: 404,
        success: false,
        message: 'Resource not found'
      });
    }
  };
}
```

## Security Headers

```javascript
// Comprehensive security headers
const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Additional security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});
```

## Audit Logging

```javascript
// Comprehensive audit logging
class AuditLogger {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.File({ 
          filename: 'logs/audit.log',
          maxsize: 10485760, // 10MB
          maxFiles: 10
        })
      ]
    });
  }
  
  logEvent(event) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      eventType: event.type,
      userId: event.userId,
      username: event.username,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      resource: event.resource,
      action: event.action,
      result: event.result,
      metadata: event.metadata
    };
    
    this.logger.info(auditEntry);
    
    // Also store in database for querying
    this.storeInDatabase(auditEntry);
  }
  
  async storeInDatabase(entry) {
    await db.query(
      `INSERT INTO audit_logs 
       (timestamp, event_type, user_id, ip_address, action, result, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [entry.timestamp, entry.eventType, entry.userId, 
       entry.ipAddress, entry.action, entry.result, entry.metadata]
    );
  }
}

// Audit middleware
function auditMiddleware(action) {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      auditLogger.logEvent({
        type: 'API_CALL',
        userId: req.user?.id,
        username: req.user?.username,
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        resource: req.path,
        action: action,
        result: res.statusCode < 400 ? 'SUCCESS' : 'FAILURE',
        metadata: {
          method: req.method,
          statusCode: res.statusCode,
          requestBody: req.body,
          responseSize: data?.length
        }
      });
      
      originalSend.call(this, data);
    };
    
    next();
  };
}
```

## Vulnerability Management

### Dependency Scanning

```json
// package.json scripts
{
  "scripts": {
    "security:check": "npm audit",
    "security:fix": "npm audit fix",
    "security:scan": "snyk test",
    "security:monitor": "snyk monitor"
  }
}
```

### Security Testing

```javascript
// Security test suite
describe('Security Tests', () => {
  test('SQL Injection Prevention', async () => {
    const maliciousInput = "'; DROP TABLE users; --";
    const response = await request(app)
      .post('/api/search')
      .send({ query: maliciousInput });
    
    expect(response.status).not.toBe(500);
    // Verify table still exists
    const tableExists = await checkTableExists('users');
    expect(tableExists).toBe(true);
  });
  
  test('XSS Prevention', async () => {
    const xssPayload = '<script>alert("XSS")</script>';
    const response = await request(app)
      .post('/api/comment')
      .send({ content: xssPayload });
    
    expect(response.body.content).not.toContain('<script>');
  });
  
  test('Rate Limiting', async () => {
    const promises = [];
    for (let i = 0; i < 150; i++) {
      promises.push(
        request(app).get('/api/data')
      );
    }
    
    const responses = await Promise.all(promises);
    const rateLimited = responses.filter(r => r.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});
```

## Compliance

### GDPR Compliance

```javascript
// Data export for GDPR
async function exportUserData(userId) {
  const userData = await db.query(
    'SELECT * FROM users WHERE id = $1',
    [userId]
  );
  
  const userFiles = await db.query(
    'SELECT * FROM files WHERE owner_id = $1',
    [userId]
  );
  
  const auditLogs = await db.query(
    'SELECT * FROM audit_logs WHERE user_id = $1',
    [userId]
  );
  
  return {
    profile: userData.rows[0],
    files: userFiles.rows,
    auditHistory: auditLogs.rows
  };
}

// Data deletion for GDPR
async function deleteUserData(userId) {
  await db.query('BEGIN');
  
  try {
    // Delete user files
    await db.query('DELETE FROM files WHERE owner_id = $1', [userId]);
    
    // Anonymize audit logs
    await db.query(
      "UPDATE audit_logs SET user_id = 'DELETED', metadata = '{}' WHERE user_id = $1",
      [userId]
    );
    
    // Delete user account
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}
```

### Security Policies

```javascript
// Cookie policy
app.use((req, res, next) => {
  res.cookie('session', req.session.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 86400000,
    signed: true
  });
  next();
});

// Password policy enforcement
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*]/.test(password);
  
  if (password.length < minLength) {
    return { valid: false, message: 'Password must be at least 8 characters' };
  }
  
  if (!hasUpperCase || !hasLowerCase) {
    return { valid: false, message: 'Password must contain both uppercase and lowercase letters' };
  }
  
  if (!hasNumbers) {
    return { valid: false, message: 'Password must contain at least one number' };
  }
  
  if (!hasSpecialChar) {
    return { valid: false, message: 'Password must contain at least one special character' };
  }
  
  return { valid: true };
}
```

## Incident Response

### Security Incident Handler

```javascript
class SecurityIncidentHandler {
  async handleIncident(incident) {
    // Log incident
    await this.logIncident(incident);
    
    // Notify administrators
    await this.notifyAdmins(incident);
    
    // Take automatic action if needed
    await this.automaticResponse(incident);
    
    // Create incident report
    return await this.createReport(incident);
  }
  
  async automaticResponse(incident) {
    switch (incident.type) {
      case 'BRUTE_FORCE':
        await this.blockIP(incident.sourceIP);
        break;
      
      case 'SUSPICIOUS_ACTIVITY':
        await this.lockAccount(incident.userId);
        break;
      
      case 'DATA_BREACH':
        await this.initiateEmergencyProtocol();
        break;
    }
  }
}
```

## Best Practices

1. **Regular Security Updates**
   - Update dependencies weekly
   - Apply security patches immediately
   - Monitor CVE databases

2. **Secure Development**
   - Code reviews for security
   - Static code analysis
   - Penetration testing

3. **Access Management**
   - Principle of least privilege
   - Regular access reviews
   - Strong authentication requirements

4. **Data Protection**
   - Encrypt sensitive data
   - Secure key management
   - Regular backups

5. **Monitoring**
   - Real-time threat detection
   - Anomaly detection
   - Regular security audits