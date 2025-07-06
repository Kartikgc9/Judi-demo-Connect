const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { protect, requireAgent } = require('../middleware/auth');
const Property = require('../models/Property');
const User = require('../models/User');

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Check file type
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Not an image! Please upload only images.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Maximum 10 files
  },
  fileFilter: fileFilter
});

// Helper function to upload to Cloudinary
const uploadToCloudinary = (buffer, folder, filename) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'image',
        folder: folder,
        public_id: filename,
        transformation: [
          { width: 1200, height: 800, crop: 'limit' },
          { quality: 'auto' },
          { format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    ).end(buffer);
  });
};

// @route   POST /api/upload/property-images/:propertyId
// @desc    Upload property images
// @access  Private (Agents only)
router.post('/property-images/:propertyId', protect, requireAgent, upload.array('images', 10), async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.propertyId);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check ownership
    if (property.agent.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to upload images for this property'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded'
      });
    }

    const uploadPromises = req.files.map(async (file, index) => {
      const filename = `property_${property._id}_${Date.now()}_${index}`;
      const result = await uploadToCloudinary(file.buffer, 'properties', filename);
      
      return {
        public_id: result.public_id,
        url: result.secure_url,
        caption: req.body.captions ? req.body.captions[index] : '',
        isPrimary: index === 0 && property.images.length === 0 // First image is primary if no images exist
      };
    });

    const uploadedImages = await Promise.all(uploadPromises);

    // Add images to property
    property.images.push(...uploadedImages);
    await property.save();

    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      images: uploadedImages,
      totalImages: property.images.length
    });
  } catch (error) {
    next(error);
  }
});

// @route   PUT /api/upload/property-images/:propertyId/:imageId
// @desc    Update property image details
// @access  Private (Property owner)
router.put('/property-images/:propertyId/:imageId', protect, async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.propertyId);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check ownership
    if (property.agent.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update images for this property'
      });
    }

    const imageIndex = property.images.findIndex(img => img._id.toString() === req.params.imageId);

    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    // Update image details
    if (req.body.caption !== undefined) {
      property.images[imageIndex].caption = req.body.caption;
    }

    if (req.body.isPrimary === true) {
      // Remove primary flag from all images
      property.images.forEach(img => img.isPrimary = false);
      // Set this image as primary
      property.images[imageIndex].isPrimary = true;
    }

    await property.save();

    res.status(200).json({
      success: true,
      message: 'Image updated successfully',
      image: property.images[imageIndex]
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/upload/property-images/:propertyId/:imageId
// @desc    Delete property image
// @access  Private (Property owner)
router.delete('/property-images/:propertyId/:imageId', protect, async (req, res, next) => {
  try {
    const property = await Property.findById(req.params.propertyId);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: 'Property not found'
      });
    }

    // Check ownership
    if (property.agent.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete images for this property'
      });
    }

    const imageIndex = property.images.findIndex(img => img._id.toString() === req.params.imageId);

    if (imageIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Image not found'
      });
    }

    const imageToDelete = property.images[imageIndex];

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(imageToDelete.public_id);
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
      // Continue with database deletion even if Cloudinary deletion fails
    }

    // Remove from property
    property.images.splice(imageIndex, 1);

    // If this was the primary image and there are other images, make the first one primary
    if (imageToDelete.isPrimary && property.images.length > 0) {
      property.images[0].isPrimary = true;
    }

    await property.save();

    res.status(200).json({
      success: true,
      message: 'Image deleted successfully',
      remainingImages: property.images.length
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/upload/profile-image
// @desc    Upload user profile image
// @access  Private
router.post('/profile-image', protect, upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image uploaded'
      });
    }

    const filename = `profile_${req.user.id}_${Date.now()}`;
    const result = await uploadToCloudinary(req.file.buffer, 'profiles', filename);

    // Update user profile
    const updateField = req.user.isAgent ? 'agentProfile.profileImage' : 'profileImage';
    
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        [updateField]: {
          public_id: result.public_id,
          url: result.secure_url
        }
      },
      { new: true }
    ).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile image updated successfully',
      image: {
        public_id: result.public_id,
        url: result.secure_url
      },
      user
    });
  } catch (error) {
    next(error);
  }
});

// @route   DELETE /api/upload/profile-image
// @desc    Delete user profile image
// @access  Private
router.delete('/profile-image', protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const profileImage = req.user.isAgent ? user.agentProfile?.profileImage : user.profileImage;

    if (!profileImage || !profileImage.public_id) {
      return res.status(404).json({
        success: false,
        message: 'No profile image found'
      });
    }

    // Delete from Cloudinary
    try {
      await cloudinary.uploader.destroy(profileImage.public_id);
    } catch (cloudinaryError) {
      console.error('Error deleting from Cloudinary:', cloudinaryError);
    }

    // Remove from user profile
    const updateField = req.user.isAgent ? 'agentProfile.profileImage' : 'profileImage';
    
    await User.findByIdAndUpdate(
      req.user.id,
      { $unset: { [updateField]: 1 } }
    );

    res.status(200).json({
      success: true,
      message: 'Profile image deleted successfully'
    });
  } catch (error) {
    next(error);
  }
});

// @route   POST /api/upload/documents
// @desc    Upload verification documents (for agents)
// @access  Private (Agents only)
router.post('/documents', protect, requireAgent, upload.array('documents', 5), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No documents uploaded'
      });
    }

    const uploadPromises = req.files.map(async (file, index) => {
      const filename = `doc_${req.user.id}_${Date.now()}_${index}`;
      const result = await uploadToCloudinary(file.buffer, 'documents', filename);
      
      return {
        type: req.body.types ? req.body.types[index] : 'other',
        url: result.secure_url,
        uploadedAt: new Date()
      };
    });

    const uploadedDocs = await Promise.all(uploadPromises);

    // Add documents to user's agent profile
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $push: { 'agentProfile.verificationDocuments': { $each: uploadedDocs } } },
      { new: true }
    ).select('agentProfile.verificationDocuments');

    res.status(200).json({
      success: true,
      message: 'Documents uploaded successfully',
      documents: uploadedDocs,
      totalDocuments: user.agentProfile.verificationDocuments.length
    });
  } catch (error) {
    next(error);
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Maximum is 10 files'
      });
    }
  }
  
  if (error.message === 'Not an image! Please upload only images.') {
    return res.status(400).json({
      success: false,
      message: 'Only image files are allowed'
    });
  }

  next(error);
});

module.exports = router;