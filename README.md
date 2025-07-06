# PropertyConnect - Modern Real Estate Platform

A comprehensive real estate platform built with Node.js, Express, MongoDB, and modern frontend technologies. Features property listings, agent management, user authentication, image uploads, and advanced search capabilities.

## 🚀 Features

### Core Functionality
- **User Authentication**: Secure JWT-based authentication with role-based access control
- **Property Listings**: Comprehensive property management with image uploads
- **Agent Registration**: Multi-step agent registration with profile verification
- **Search & Filtering**: Advanced property search with location, price, and feature filters
- **Contact Management**: Integrated contact form with admin dashboard
- **Image Management**: Cloudinary integration for optimized image storage
- **Responsive Design**: Modern UI built with Tailwind CSS

### Advanced Features
- **Real-time Notifications**: Toast notifications for user feedback
- **File Upload**: Multi-image upload with preview and management
- **Data Validation**: Comprehensive server-side and client-side validation
- **Error Handling**: Robust error handling with user-friendly messages
- **Security**: Rate limiting, CORS protection, and input sanitization
- **API Documentation**: Well-structured RESTful API design

## 🛠 Tech Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication tokens
- **Multer** - File upload handling
- **Cloudinary** - Image storage and optimization
- **bcryptjs** - Password hashing
- **express-validator** - Input validation
- **express-rate-limit** - API rate limiting
- **helmet** - Security middleware
- **cors** - Cross-origin resource sharing
- **compression** - Response compression
- **morgan** - HTTP request logger

### Frontend
- **HTML5** - Markup language
- **Tailwind CSS** - Utility-first CSS framework
- **Vanilla JavaScript** - Client-side scripting
- **Font Awesome** - Icon library
- **Fetch API** - HTTP client

## 📁 Project Structure

```
propertyconnect/
├── models/                 # Database models
│   ├── User.js            # User/Agent model
│   ├── Property.js        # Property model
│   └── Contact.js         # Contact form model
├── routes/                 # API routes
│   ├── auth.js            # Authentication routes
│   ├── properties.js      # Property management routes
│   ├── agents.js          # Agent-specific routes
│   ├── contact.js         # Contact form routes
│   └── upload.js          # File upload routes
├── middleware/             # Custom middleware
│   ├── auth.js            # Authentication middleware
│   └── errorHandler.js    # Error handling middleware
├── public/                 # Frontend files
│   ├── index.html         # Homepage
│   ├── login.html         # Login/Registration page
│   ├── list-property.html # Property listing form
│   ├── contact.html       # Contact page
│   ├── search.html        # Property search page
│   ├── agents.html        # Agent directory
│   └── assets/            # Static assets
│       └── js/
│           └── api.js     # Frontend API utilities
├── server.js              # Main server file
├── package.json           # Dependencies
├── .env.example          # Environment variables template
└── README.md             # Project documentation
```

## 🚀 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud instance)
- Cloudinary account (for image uploads)
- Email service (optional, for notifications)

### 1. Clone the Repository
```bash
git clone <repository-url>
cd propertyconnect
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env` and configure:

```env
# Database
MONGODB_URI=mongodb://localhost:27017/propertyconnect

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Email Configuration (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Server Configuration
PORT=5000
NODE_ENV=development

# Security
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# Frontend URL
FRONTEND_URL=http://localhost:5000
```

### 4. Start the Application

#### Development Mode
```bash
npm run dev
```

#### Production Mode
```bash
npm start
```

The application will be available at `http://localhost:5000`

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/updateprofile` - Update user profile
- `POST /api/auth/logout` - User logout
- `POST /api/auth/register-agent` - Complete agent registration

### Property Endpoints
- `GET /api/properties` - Get properties with filtering
- `GET /api/properties/featured` - Get featured properties
- `GET /api/properties/:id` - Get single property
- `POST /api/properties` - Create property (agents only)
- `PUT /api/properties/:id` - Update property
- `DELETE /api/properties/:id` - Delete property
- `POST /api/properties/:id/inquiry` - Submit property inquiry
- `GET /api/properties/agent/my-properties` - Get agent's properties

### Agent Endpoints
- `GET /api/agents` - Get agents with filtering
- `GET /api/agents/top` - Get top-rated agents
- `GET /api/agents/:id` - Get agent profile
- `GET /api/agents/:id/properties` - Get agent's properties
- `PUT /api/agents/profile` - Update agent profile
- `POST /api/agents/:id/rate` - Rate an agent
- `GET /api/agents/dashboard/stats` - Get agent dashboard stats

### Contact Endpoints
- `POST /api/contact` - Submit contact form
- `GET /api/contact` - Get all contacts (admin only)
- `GET /api/contact/:id` - Get single contact
- `PUT /api/contact/:id` - Update contact status
- `POST /api/contact/:id/notes` - Add response notes

### Upload Endpoints
- `POST /api/upload/property-images/:propertyId` - Upload property images
- `PUT /api/upload/property-images/:propertyId/:imageId` - Update image details
- `DELETE /api/upload/property-images/:propertyId/:imageId` - Delete image
- `POST /api/upload/profile-image` - Upload profile image
- `POST /api/upload/documents` - Upload verification documents

## 🎯 Usage

### For Property Seekers
1. **Browse Properties**: Visit the homepage to see featured properties
2. **Search**: Use the search page to filter properties by location, price, type, etc.
3. **Contact Agents**: View agent profiles and contact them directly
4. **Submit Inquiries**: Send inquiries for specific properties
5. **Create Account**: Register to save favorites and track inquiries

### For Real Estate Agents
1. **Register**: Create an agent account with license verification
2. **Complete Profile**: Add experience, specializations, and contact details
3. **List Properties**: Use the comprehensive property listing form
4. **Upload Images**: Add multiple high-quality images for each property
5. **Manage Listings**: Update property status, edit details, and respond to inquiries
6. **Dashboard**: Track performance metrics and manage inquiries

### For Administrators
1. **Monitor Contacts**: Review and respond to contact form submissions
2. **User Management**: Manage user accounts and agent verifications
3. **Content Moderation**: Review and approve property listings
4. **Analytics**: Access detailed statistics and reports

## 🔧 Configuration

### Database Indexes
The application automatically creates the following indexes for optimal performance:
- User email and agent license numbers
- Property location, type, and price ranges
- Contact submissions by status and date

### File Upload Limits
- **Property Images**: Maximum 10 images per property, 10MB each
- **Profile Images**: Single image, 10MB maximum
- **Documents**: Maximum 5 files for agent verification

### Security Features
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS Protection**: Configured for specific frontend origins
- **Input Validation**: Comprehensive validation on all endpoints
- **Password Hashing**: bcrypt with salt rounds
- **JWT Security**: Secure token generation and validation

## 🚀 Deployment

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure production database URL
3. Set secure JWT secret
4. Configure Cloudinary for production
5. Set up proper CORS origins

### Production Considerations
- Use environment variables for all sensitive configuration
- Set up proper SSL/TLS certificates
- Configure reverse proxy (nginx recommended)
- Set up monitoring and logging
- Implement backup strategies for database and uploaded files

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- Email: support@propertyconnect.com
- Create an issue in the repository
- Check the documentation and API endpoints

## 🔄 Updates & Maintenance

### Regular Tasks
- Monitor database performance and optimize queries
- Update dependencies for security patches
- Review and clean up uploaded files
- Backup database regularly
- Monitor API usage and performance

### Future Enhancements
- Mobile application development
- Advanced analytics dashboard
- Integration with external property APIs
- Real-time messaging between agents and clients
- Virtual property tours
- Advanced search with AI recommendations

---

**PropertyConnect** - Connecting properties, agents, and dreams! 🏠✨