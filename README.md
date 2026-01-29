# JobFlow Backend API

Multi-tenant SaaS backend for JobFlow Dashboard with GoHighLevel integration.

## Project Structure

```
backend/
├── server.js              # Main Express app
├── package.json           # Dependencies
├── .env                   # Environment variables (create from .env.example)
├── config/
│   └── database.js        # PostgreSQL connection
├── middleware/
│   └── auth.js            # JWT authentication
├── routes/
│   ├── auth.js            # Login/logout endpoints
│   ├── leads.js           # Lead CRUD operations
│   ├── users.js           # User management
│   └── companies.js       # Company management (master admin)
└── controllers/
    └── ghlAPI.js          # GoHighLevel API integration
```

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL` - Your Railway PostgreSQL connection string
- `JWT_SECRET` - Random secret for JWT tokens
- `ENCRYPTION_KEY` - Random secret for encrypting GHL API keys

### 3. Generate Secrets

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. Run Development Server

```bash
npm run dev
```

Server will start on http://localhost:3001

### 5. Test API

Health check:
```bash
curl http://localhost:3001/health
```

## Deployment to Railway

### 1. Create New Service in Railway

1. Go to your Railway project
2. Click "New Service" → "GitHub Repo"
3. Select your backend repository
4. Railway will auto-detect Node.js

### 2. Configure Environment Variables in Railway

Go to your backend service → Variables tab → Add all variables from `.env`:

- `DATABASE_URL` - Copy from your PostgreSQL service (Railway provides this automatically)
- `JWT_SECRET` - Paste your generated secret
- `ENCRYPTION_KEY` - Paste your generated secret
- `NODE_ENV` - Set to `production`
- `PORT` - Railway sets this automatically

### 3. Deploy

Railway will automatically build and deploy when you push to GitHub.

Build command: `npm install`
Start command: `npm start`

### 4. Get Your API URL

After deployment, Railway will give you a URL like:
`https://jobflow-backend.up.railway.app`

Save this URL - you'll need it to configure your frontend!

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Leads
- `GET /api/leads` - Get all leads
- `GET /api/leads/:id` - Get single lead
- `POST /api/leads` - Create lead (syncs to GHL)
- `PUT /api/leads/:id` - Update lead (syncs to GHL)
- `DELETE /api/leads/:id` - Delete lead

### Users
- `GET /api/users` - Get company users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `PUT /api/users/me/password` - Change own password

### Companies (Master Admin Only)
- `GET /api/companies` - Get all companies
- `GET /api/companies/:id` - Get company
- `POST /api/companies` - Create company & admin user
- `PUT /api/companies/:id` - Update company
- `DELETE /api/companies/:id` - Delete company

## Creating Your Master Admin User

After deployment, you need to create your master admin account in the database:

### Using TablePlus

```sql
-- First, create a master company
INSERT INTO companies (company_name, billing_status)
VALUES ('JobFlow Master', 'active')
RETURNING id;

-- Then create your master user (replace values)
-- Password hash for 'ChangeMe123!' - you'll change this after first login
INSERT INTO users (
  company_id, 
  email, 
  password_hash, 
  name, 
  role, 
  is_active
) VALUES (
  1,  -- Use the company ID from above
  'troy@epoxyprofitformula.com',
  '$2b$10$EXAMPLEHASH',  -- Generate with: bcrypt.hash('ChangeMe123!', 10)
  'Troy (Master Admin)',
  'master',
  true
);
```

Or use this Node.js script to generate password hash:

```javascript
const bcrypt = require('bcryptjs');
bcrypt.hash('ChangeMe123!', 10).then(hash => console.log(hash));
```

## Testing the Deployment

### 1. Test Health Endpoint

```bash
curl https://your-railway-url.up.railway.app/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": "2024-12-04T...",
  "service": "JobFlow Backend API"
}
```

### 2. Test Login

```bash
curl -X POST https://your-railway-url.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"troy@epoxyprofitformula.com","password":"ChangeMe123!"}'
```

Should return JWT token and user data.

## Next Steps

After backend is deployed:

1. ✅ Update frontend to use backend API instead of localStorage
2. ✅ Configure GHL webhooks to point to your backend
3. ✅ Create your first contractor company
4. ✅ Test full workflow: Create lead → Syncs to GHL

## Troubleshooting

### Database connection errors
- Verify DATABASE_URL is correct
- Check Railway PostgreSQL service is running

### JWT errors
- Ensure JWT_SECRET is set in environment variables
- Check token is being sent in Authorization header

### GHL sync errors
- Verify GHL API key is correct for the company
- Check GHL location ID matches
- View sync_logs table for error details

## Security Notes

- Never commit `.env` file
- Always use HTTPS in production
- Rotate JWT_SECRET and ENCRYPTION_KEY periodically
- GHL API keys are encrypted in database
- Use strong passwords for user accounts
