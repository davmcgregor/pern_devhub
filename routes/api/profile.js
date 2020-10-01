const express = require('express');
const router = express.Router();
const auth = require('../../middleware/auth');
const { body, validationResult } = require('express-validator');

const pool = require('../../db');

// @route GET api/profile/me
// @desc Get current users profile
// @access Private

router.get('/me', auth, async (req, res) => {
  try {
    const profile = await pool.query(
      'SELECT user_id, user_name, user_avatar FROM users INNER JOIN profiles USING(user_id) WHERE user_id = $1',
      [req.user.id]
    );

    if (!profile.rows.length) {
      return res.status(400).json({ msg: 'There is no profile for this user' });
    }

    res.json(profile.rows[0]);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route POST api/profile
// @desc Create or update user profile
// @access Private

router.post(
  '/',
  [
    auth,
    [
      body('status', 'Status is required').not().isEmpty(),
      body('skills', 'Skills is required').not().isEmpty(),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      company,
      location,
      website,
      bio,
      skills,
      status,
      githubusername,
      youtube,
      twitter,
      instagram,
      linkedin,
      facebook,
    } = req.body;

    // Build profile object

    const profileFields = {};
    profileFields.user = req.user.id;
    if (company) profileFields.company = company;
    if (website) profileFields.website = website;
    if (location) profileFields.location = location;
    if (bio) profileFields.bio = bio;
    if (status) profileFields.status = status;
    if (githubusername) profileFields.githubusername = githubusername;
    if (skills) {
      profileFields.skills = skills.split(',').map((skill) => skill.trim());
    }

    // Build social object
    profileFields.social = {};
    if (youtube) profileFields.social.youtube = youtube;
    if (twitter) profileFields.social.twitter = twitter;
    if (facebook) profileFields.social.facebook = facebook;
    if (linkedin) profileFields.social.linkedin = linkedin;
    if (instagram) profileFields.social.instagram = instagram;

    try {
      const profile = await pool.query(
        'INSERT INTO profiles (user_id, profile_company, profile_website, profile_location, profile_status, profile_skills, profile_bio, profile_githubusername, profile_social) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (user_id) DO UPDATE SET profile_company = $2, profile_website = $3, profile_location = $4, profile_status = $5, profile_skills = $6, profile_bio = $7, profile_githubusername = $8, profile_social = $9 RETURNING *',
        [
          req.user.id,
          profileFields.company,
          profileFields.website,
          profileFields.location,
          profileFields.status,
          profileFields.skills,
          profileFields.bio,
          profileFields.githubusername,
          profileFields.social,
        ]
      );

      res.json(profile.rows[0]);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
  }
);

// @route    GET api/profile
// @desc     Get all profiles
// @access   Public
router.get('/', async (req, res) => {
  try {
    const profiles = await await pool.query(
      'SELECT u.user_id, u.user_name, u.user_avatar, p.profile_company, p.profile_website, p.profile_location, p.profile_status, p.profile_skills, p.profile_bio, p.profile_githubusername, p.profile_social, to_json(array_agg(e.*)) AS experiences FROM users u INNER JOIN profiles p ON p.user_id = u.user_id LEFT JOIN experiences e ON e.user_id = p.user_id GROUP BY u.user_id, p.profile_company, p.profile_website, p.profile_location, p.profile_status, p.profile_skills, p.profile_bio, p.profile_githubusername, p.profile_social'
    );
    res.json(profiles.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route GET api/profile/user/:user_id
// @desc Get profile by user ID
// @access Public

router.get('/user/:user_id', async (req, res) => {
  try {
    const profile = await pool.query(
      'SELECT u.user_id, u.user_name, u.user_avatar, p.profile_company, p.profile_website, p.profile_location, p.profile_status, p.profile_skills, p.profile_bio, p.profile_githubusername, p.profile_social, to_json(array_agg(e.*)) AS experiences FROM users u INNER JOIN profiles p ON p.user_id = u.user_id LEFT JOIN experiences e ON e.user_id = p.user_id WHERE u.user_id::text = $1 GROUP BY u.user_id, p.profile_company, p.profile_website, p.profile_location, p.profile_status, p.profile_skills, p.profile_bio, p.profile_githubusername, p.profile_social',
      [req.params.user_id]
    );

    if (!profile.rows.length) {
      return res.status(400).json({ msg: 'Profile not found' });
    }

    res.json(profile.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route DELETE api/profile
// @desc Delete profile, user & posts
// @access Private

router.delete('/', auth, async (req, res) => {
  try {
    // @todo - remove users posts

    // Remove profile
    await pool.query('DELETE FROM profiles WHERE user_id = $1 RETURNING *', [
      req.user.id,
    ]);

    //Remove user
    await pool.query('DELETE FROM users WHERE user_id = $1 RETURNING *', [
      req.user.id,
    ]);

    res.json({ msg: 'User deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route INSERT api/profile/experience
// @desc Add profile experience
// @access Private

router.post(
  '/experience',
  [
    auth,
    [
      body('title', 'Title is required').not().isEmpty(),
      body('company', 'Company is required').not().isEmpty(),
      body('from', 'From date is required').not().isEmpty(),
    ],
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      title,
      company,
      location,
      from,
      to,
      current,
      description,
    } = req.body;

    const experienceFields = {
      title,
      company,
      location,
      from,
      to,
      current,
      description,
    };

    try {
      const experience = await pool.query(
        'INSERT INTO experiences (user_id, experience_title, experience_company, experience_location, experience_from, experence_to, experience_current, experience_description) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [
          req.user.id,
          experienceFields.title,
          experienceFields.company,
          experienceFields.location,
          experienceFields.from,
          experienceFields.to,
          experienceFields.current,
          experienceFields.description,
        ]
      );

      res.json(experience.rows[0]);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server Error');
    }
  }
);

module.exports = router;
