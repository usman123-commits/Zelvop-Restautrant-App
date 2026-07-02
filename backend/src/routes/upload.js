const express = require('express');
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(protect);
router.use(authorize('rider'));

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// POST /api/v1/upload/proof-photo
router.post('/proof-photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'zelvop/delivery-proofs',
          resource_type: 'image',
          transformation: [{ width: 1024, height: 1024, crop: 'limit', quality: 'auto' }],
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    res.json({ url: result.secure_url, publicId: result.public_id });
  } catch (err) {
    if (err.message === 'Only image files are allowed') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Failed to upload photo' });
  }
});

module.exports = router;
