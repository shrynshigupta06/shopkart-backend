const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const qrcode = require("qrcode");
const cloudinary = require('cloudinary');
const SendOtp = require("sendotp");
const axios = require("axios");
const imgUpload = require('../config/imgUpload');
const User = require("../models/User");
const Contact = require("../models/Contacts");

let { messageTemplate, email1, email2, email3, email6 } = require("../config/templates");

const sendOtp = new SendOtp(process.env.MSG91_API_KEY, messageTemplate);

sendVerificationLink = async (req, res) => {
  let email = req;
  let user = await User.findOne({ email });
  if (user) {
    if (user.isEmailVerified === true) {
      return res.status(400).json({ message: "Already Verified!" });
    } else {
      let token = Date.now() + user._id + Math.random(10000000000);
      user.verifyEmail.token = token;
      user.verifyEmail.expiresIn = Date.now() + 3600000;
      await user.save();
      await email1(user._id, user.name, email, token);
    }
  } else {
    return res.status(400).json({ success: false, message: "User not found!" });
  }
};

sendOtpToMobile = async (req, res) => {
  let user = req;
  temp = 1;
  await sendOtp.send(user.contact, "Shopkart", (err, data) => {
    if (data.type === "error") temp1 = 0;
    else {
      user.otpExpiresIn = Date.now() + 600000;
      user.save();
      sendOtp.setOtpExpiry("10"); //in minutes
    }
  });
}

sendWelcomeEmail = async (req, res) => {
  let { email, password } = req;
  let user = await User.findOne({ email });
  if (user) {
    await email6(user._id, user.name, email, user.contact, password, user.verifyEmail.token);
  }
  else {
    return res.status(400).json({ success: false, message: "User not found!" });
  }
}

forgetPasswordEmail = async (req, res) => {
  let email = req;
  let user = await User.findOne({ email });
  if (user) {
    let password = generatePassword();
    const salt = await bcrypt.genSalt(10);
    let token = await bcrypt.hash(password, salt);
    user.resetPwd.token = token;
    user.resetPwd.expiresIn = Date.now() + 3600000;
    await user.save();
    await email2(user._id, user.name, email, password);
  } else {
    return res.status(400).json({ success: false, message: "User not found!" });
  }
};

mailToDeletedUsers = async (req, res) => {
  let email = req;
  let user = await User.findOne({ email });
  if (user) {
    await email3(user.name, email);
  } else {
    return res.status(400).json({ success: false, message: "User not found!" });
  }
};

generatePassword = (req, res) => {
  var length = 8,
    charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    retVal = "";
  for (var i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}

generateRandomString = (req, res) => {
  var length = 8,
    charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
    retVal = "";
  for (var i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}

module.exports.register = async (req, res) => {
  let { firstName, lastName, email, contact, password, confirmPassword, referral_code, role } = req.body;
  if (!role)
    role = "customer";
  var name;
  contact = "+91" + contact;
  let x = generateRandomString();
  let bonus = 0;
  if (lastName === undefined) name = firstName;
  else name = firstName + " " + lastName;
  if (!name || !email || !contact || !password || !role)
    return res.status(400).json({
      status: false,
      message: "All fields are mandatory!"
    });
  let emailRegex = /^\S+@\S+\.\S+/,
    phoneRegex = /^([0|\+[0-9]{1,5})?([6-9][0-9]{9})$/,
    passwordRegex = /^[\S]{8,}/;
  if (emailRegex.test(email)) {
    if (passwordRegex.test(String(password))) {
      if (phoneRegex.test(Number(contact))) {
        let user = await User.findOne({ $or: [{ email: email }, { contact: contact }] });
        if (user) {
          return res
            .status(400)
            .json({
              status: false,
              message: "Email or Contact already registered with us!"
            });
        } else {
          if (role == "staff")
            return res.status(400).json({ message: "You can't register as a staff! Ask your manager to get you registered!" });
          let newUser;
          if (referral_code && role == "customer") {
            temp_user = await User.findOne({ referral_code });
            if (!temp_user)
              return res.status(400).json({ status: false, message: "Referral Code is not valid!" });
            temp_user.bonus = 100;
            temp_user.save();
            newUser = {
              name,
              email,
              password,
              role,
              bonus: 50,
              contact
            };
            bonus = 50;
          }
          else {
            newUser = {
              name,
              email,
              password,
              role,
              contact
            };
          }
          const salt = await bcrypt.genSalt(10);
          newUser.password = await bcrypt.hash(newUser.password, salt);
          user = await User.create(newUser);
          (temp = 1), (temp1 = 1);
          try {
            await sendVerificationLink(newUser.email);
          } catch (err) {
            temp = 0;
            console.log(err);
          }
          try {
            await sendOtpToMobile(user);
          } catch (err) {
            console.log(err);
          }
          if (temp === 0) {
            return res.status(400).json({
              success: false,
              message: "Registeration Successful!",
              error: "Verification Email cannot be sent. Login to recieve!"
            });
          } else if (temp1 === 0) {
            return res.status(400).json({
              success: false,
              message: "Registeration Successful!",
              error: "OTP cannot be sent. Login to recieve!"
            });
          } else if (temp === 0 && temp1 === 0) {
            return res.status(400).json({
              success: false,
              message: "Registeration Successful!",
              error:
                "Verification Email & OTP cannot be sent. Login to recieve!"
            });
          } else {
            if (bonus == 0)
              res.status(200).json({
                success: true,
                message:
                  "Registeration Successful! Verify Your Email Address & Mobile Number!"
              });
            else
              res.status(200).json({
                success: true,
                message:
                  "Registeration Successful! Hurray! You have recieved 50 bonus points.. Verify Your Email Address & Mobile Number to claim the reward!"
              });
          }
        }
      } else {
        return res.status(400).json({ message: "Contact number not valid!" });
      }
    } else {
      return res
        .status(400)
        .json({ message: "Password must be atleast 8 characters long!" });
    }
  } else {
    return res.status(400).json({ message: "EmailID is not valid!" });
  }
};

module.exports.addStaff = async (req, res) => {
  let { firstName, lastName, email, contact } = req.body;
  let role = "staff";
  let password = generatePassword();
  var name;
  if (lastName === "") name = firstName;
  else name = firstName + " " + lastName;
  if (!name || !email || !contact || !password || !role)
    return res.status(400).json({ message: "All fields are mandatory!" });
  let emailRegex = /^\S+@\S+\.\S+/,
    phoneRegex = /^([0|\+[0-9]{1,5})?([6-9][0-9]{9})$/,
    passwordRegex = /^[\S]{8,}/;
  if (emailRegex.test(email)) {
    if (passwordRegex.test(String(password))) {
      if (phoneRegex.test(Number(contact))) {
        let user = await User.findOne({ $or: [{ email: email }, { contact: contact }] });
        if (user) {
          return res
            .status(400)
            .json({ message: "Email or Contact already registered with us!" });
        } else {
          let newUser;
          newUser = {
            name,
            email,
            password,
            role,
            admin: req.user.data._id,
            contact
          };
          const salt = await bcrypt.genSalt(10);
          newUser.password = await bcrypt.hash(newUser.password, salt);
          user = await User.create(newUser);
          (temp = 1), (temp1 = 1);
          try {
            await sendVerificationLink(newUser.email);
          } catch (err) {
            temp = 0;
            console.log(err);
          }
          try {
            await sendOtpToMobile(user);
          } catch (err) {
            temp1 = 0;
            console.log(err);
          }
          if (temp === 0) {
            return res.status(400).json({
              success: false,
              message: "Registeration Successful!",
              error: "Verification Email cannot be sent. Login to recieve!"
            });
          } else if (temp1 === 0) {
            return res.status(400).json({
              success: false,
              message: "Registeration Successful!",
              error: "OTP cannot be sent. Login to recieve!"
            });
          } else if (temp === 0 && temp1 === 0) {
            return res.status(400).json({
              success: false,
              message: "Registeration Successful!",
              error:
                "Verification Email & OTP cannot be sent. Login to recieve!"
            });
          } else {
            await sendWelcomeEmail({ email, password });
            res.status(200).json({
              success: true,
              message:
                "Staff Added Successfully!"
            });
          }
        }
      } else {
        return res.status(400).json({ message: "Contact number not valid!" });
      }
    } else {
      return res
        .status(400)
        .json({ message: "Password must be atleast 8 characters long!" });
    }
  } else {
    return res.status(400).json({ message: "EmailID is not valid!" });
  }
};

module.exports.login = async (req, res) => {
  let { email, mobile, password } = req.body;
  mobile = "+91" + mobile;
  var user;
  user = await User.findOne({ $or: [{ email: email }, { contact: mobile }] });
  if (!user) {
    return res.status(400).json({ success: false, reset: false, message: "User not found!" });
  }
  let isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    if (!user.resetPwd.token)
      return res.status(401).json({ success: false, reset: false, message: "Wrong Credentials!" });
    else {
      if (user.resetPwd.expiresIn < Date.now()) {
        forgetPasswordEmail(user.email);
        return res.status(400).json({
          success: false,
          reset: false,
          message: "Time Expired! New Email is sent!"
        });
      } else {
        let isMatch1 = await bcrypt.compare(password, user.resetPwd.token);
        if (isMatch1) {
          return res.status(200).json({
            success: false,
            reset: true,
            message: "Now you can reset your password!"
          });
        }
        else {
          return res.status(400).json({
            success: false,
            reset: false,
            message: "Enter the password sent to your mail correctly!"
          });
        }
      }
    }
  } else if (
    isMatch &&
    user.isEmailVerified === false &&
    user.isContactVerified === false
  ) {
    if (
      user.verifyEmail.expiresIn >= Date.now() &&
      user.otpExpiresIn >= Date.now()
    ) {
      return res.status(401).json({
        success: false,
        reset: false,
        message: "Verify your EmailID & your Mobile Number!"
      });
    } else if (user.verifyEmail.expiresIn < Date.now()) {
      await sendVerificationLink(user.email);
      return res.status(401).json({
        success: false,
        reset: false,
        message: "Verify your EmailID Now!"
      });
    } else if (user.otpExpiresIn < Date.now()) {
      await sendOtpToMobile(user);
      return res.status(401).json({
        success: false,
        reset: false,
        message: "Verify your Mobile No. Now!"
      });
    } else {
      await sendVerificationLink(user.email);
      await sendOtpToMobile(user);
      return res.status(401).json({
        success: false,
        reset: false,
        message: "Verify your EmailID & your Mobile Number now!"
      });
    }
  } else if (isMatch && user.isContactVerified === false) {
    if (user.otpExpiresIn >= Date.now()) {
      return res
        .status(401)
        .json({ success: false, reset: false, message: "Verify your Mobile No.!" });
    } else {
      await sendOtpToMobile(user);
      return res
        .status(401)
        .json({ success: false, reset: false, message: "Verify your Mobile No. now!" });
    }
  } else if (isMatch && user.isEmailVerified === false) {
    if (user.verifyEmail.expiresIn >= Date.now()) {
      return res
        .status(401)
        .json({ success: false, reset: false, message: "Verify your EmailID!" });
    } else {
      await sendVerificationLink(user.email);
      return res
        .status(401)
        .json({ success: false, reset: false, message: "Verify your EmailID now!" });
    }
  } else {
    if (user.resetPwd.token) {
      user.resetPwd.token = undefined;
      user.resetPwd.expiresIn = undefined;
      user.save();
    }
    if (!user.qrcode.id) {
      let user1 = {
        _id: undefined,
        name: undefined,
        email: undefined,
        role: undefined,
        contact: undefined
      };
      user1._id = user._id;
      user1.name = user.name;
      user1.email = user.email;
      user1.role = user.role;
      user1.contact = user.contact;
      let JSONobject = JSON.stringify(user1);
      var opts = {
        errorCorrectionLevel: 'H',
        type: 'image/jpeg',
        quality: 1,
        margin: 1
      }
      qrcode.toDataURL(JSONobject, opts)
        .then(url => {
          cloudinary.uploader.upload(url, (result, error) => {
            if (result) {
              user.qrcode.id = result.public_id;
              user.qrcode.url = result.url;
              user.save();
            } else if (error) {
              console.log("QR Code is not Uploaded!");
            }
          });
        })
        .catch(err => {
          console.error(err)
        })
    }
    const token = jwt.sign(
      {
        type: "user",
        data: {
          _id: user._id,
          name: user.name,
          email: user.email,
          contact: user.contact,
          role: user.role,
          qrcode_url: user.qrcode.url
        }
      },
      process.env.SECRET,
      {
        expiresIn: 604800 // for 1 week time in seconds
      }
    );
    let user2 = {
      _id: undefined,
      name: undefined,
      email: undefined,
      role: undefined,
      contact: undefined,
      qrcode: {
        id: undefined,
        url: undefined
      },
      referral_code: undefined,
      bonus: undefined
    };
    user2._id = user._id;
    user2.name = user.name;
    user2.email = user.email;
    user2.role = user.role;
    user2.contact = user.contact;
    user2.qrcode.id = user.qrcode.id;
    user2.qrcode.qrcode_url = user.qrcode.url;
    user2.referral_code = user.referral_code;
    user2.bonus = user.bonus;
    return res
      .header("x-auth-token", token)
      .status(200)
      .json({ success: true, reset: false, message: "Logged In!", token: token, user: user2 });
  }
};

module.exports.verifyEmail = async (req, res) => {
  let { email, token } = req.params;
  let user = await User.findOne({ email: email });
  if (user) {
    if (user.isEmailVerified === true && user.isContactVerified === true) {
      if (!user.qrcode.id) {
        let user1 = {
          _id: undefined,
          name: undefined,
          email: undefined,
          role: undefined,
          contact: undefined
        };
        user1._id = user._id;
        user1.name = user.name;
        user1.email = user.email;
        user1.role = user.role;
        user1.contact = user.contact;
        let JSONobject = JSON.stringify(user1);
        var opts = {
          errorCorrectionLevel: 'H',
          type: 'image/jpeg',
          quality: 1,
          margin: 1
        }
        qrcode.toDataURL(JSONobject, opts)
          .then(url => {
            cloudinary.uploader.upload(url, (result, error) => {
              if (result) {
                user.qrcode.id = result.public_id;
                user.qrcode.url = result.url;
                user.save();
              } else if (error) {
                console.log("QR Code is not Uploaded!");
              }
            });
          })
          .catch(err => {
            console.error(err)
          })
      }
      const token = jwt.sign(
        {
          type: "user",
          data: {
            _id: user._id,
            name: user.name,
            email: user.email,
            contact: user.contact,
            role: user.role
          }
        },
        process.env.SECRET,
        {
          expiresIn: 604800 // for 1 week time in seconds
        }
      );
      res
        .header("x-auth-token", token)
        .status(200)
        .json({ success: true, message: "Already Verified" });
    } else if (
      user.isEmailVerified === true &&
      user.isContactVerified === false
    ) {
      if (user.otpExpiresIn >= Date.now())
        res.status(200).json({
          success: true,
          message: "Already Verified! Verify your Mobile No."
        });
      else {
        await sendOtpToMobile(user);
        res.status(200).json({
          success: true,
          message: "Already Verified! Verify your Mobile No. Now"
        });
      }
    } else if (
      user.verifyEmail.expiresIn >= Date.now() &&
      user.verifyEmail.token === token &&
      user.isContactVerified === true
    ) {
      if (user.role == "customer")
        user.referral_code = generateRandomString();
      user.isEmailVerified = true;
      user.verifyEmail.token = undefined;
      user.verifyEmail.expiresIn = undefined;
      await user.save();
      if (!user.qrcode.id) {
        let user1 = {
          _id: undefined,
          name: undefined,
          email: undefined,
          role: undefined,
          contact: undefined
        };
        user1._id = user._id;
        user1.name = user.name;
        user1.email = user.email;
        user1.role = user.role;
        user1.contact = user.contact;
        let JSONobject = JSON.stringify(user1);
        var opts = {
          errorCorrectionLevel: 'H',
          type: 'image/jpeg',
          quality: 1,
          margin: 1
        }
        qrcode.toDataURL(JSONobject, opts)
          .then(url => {
            cloudinary.uploader.upload(url, (result, error) => {
              if (result) {
                user.qrcode.id = result.public_id;
                user.qrcode.url = result.url;
                user.save();
              } else if (error) {
                console.log("QR Code is not Uploaded!");
              }
            });
          })
          .catch(err => {
            console.error(err)
          })
      }
      const token = jwt.sign(
        {
          type: "user",
          data: {
            _id: user._id,
            name: user.name,
            email: user.email,
            contact: user.contact,
            role: user.role
          }
        },
        process.env.SECRET,
        {
          expiresIn: 604800 // for 1 week time in seconds
        }
      );
      res
        .header("x-auth-token", token)
        .status(200)
        .json({
          success: true,
          message: "Email Verified! You can login now!",
          token: token
        });
    } else if (
      user.verifyEmail.expiresIn >= Date.now() &&
      user.verifyEmail.token === token &&
      user.isContactVerified === false
    ) {
      user.isEmailVerified = true;
      user.verifyEmail.token = undefined;
      user.verifyEmail.expiresIn = undefined;
      await user.save();
      if (user.otpExpiresIn >= Date.now()) {
        res.status(200).json({
          success: true,
          message: "Email Verified! Verify your Mobile no.!"
        });
      } else {
        await sendOtpToMobile(user);
        res.status(200).json({
          success: true,
          message: "Email Verified! Verify your Mobile no. now!"
        });
      }
    } else {
      await sendVerificationLink(user.email);
      res.status(400).json({ message: "Invalid Request or Link Expired!" });
    }
  } else {
    res.status(400).json({ message: "No User Found" });
  }
};

module.exports.verifyContact = async (req, res) => {
  let { contact } = req.params;
  contact = "+91" + contact;
  let { otp } = req.body;
  let user = await User.findOne({ contact: contact });
  if (user) {
    if (user.isContactVerified === true && user.isEmailVerified === true) {
      if (!user.qrcode.id) {
        let user1 = {
          _id: undefined,
          name: undefined,
          email: undefined,
          role: undefined,
          contact: undefined
        };
        user1._id = user._id;
        user1.name = user.name;
        user1.email = user.email;
        user1.role = user.role;
        user1.contact = user.contact;
        let JSONobject = JSON.stringify(user1);
        var opts = {
          errorCorrectionLevel: 'H',
          type: 'image/jpeg',
          quality: 1,
          margin: 1
        }
        qrcode.toDataURL(JSONobject, opts)
          .then(url => {
            cloudinary.uploader.upload(url, (result, error) => {
              if (result) {
                user.qrcode.id = result.public_id;
                user.qrcode.url = result.url;
                user.save();
              } else if (error) {
                console.log("QR Code is not Uploaded!");
              }
            });
          })
          .catch(err => {
            console.error(err)
          })
      }
      const token = jwt.sign(
        {
          type: "user",
          data: {
            _id: user._id,
            name: user.name,
            email: user.email,
            contact: user.contact,
            role: user.role
          }
        },
        process.env.SECRET,
        {
          expiresIn: 604800 // for 1 week time in seconds
        }
      );
      res
        .header("x-auth-token", token)
        .status(200)
        .json({ success: true, message: "Already Verified!" });
    } else if (
      user.isContactVerified === true &&
      user.isEmailVerified === false
    ) {
      if (user.verifyEmail.expiresIn >= Date.now())
        res.status(200).json({
          success: true,
          message: "Already Verified! Verify your email Id."
        });
      else {
        await sendVerificationLink(user.email);
        res.status(200).json({
          success: true,
          message: "Already Verified! Verify your email Id now."
        });
      }
    } else {
      await sendOtp.verify(contact, otp, async (error, data) => {
        console.log(data);
        if (data.type == "success") {
          if (
            user.otpExpiresIn >= Date.now() &&
            user.isEmailVerified === true
          ) {
            if (user.role == "customer")
              user.referral_code = generateRandomString();
            user.isContactVerified = true;
            user.otpExpiresIn = undefined;
            await user.save();
            if (!user.qrcode.id) {
              let user1 = {
                _id: undefined,
                name: undefined,
                email: undefined,
                role: undefined,
                contact: undefined
              };
              user1._id = user._id;
              user1.name = user.name;
              user1.email = user.email;
              user1.role = user.role;
              user1.contact = user.contact;
              let JSONobject = JSON.stringify(user1);
              var opts = {
                errorCorrectionLevel: 'H',
                type: 'image/jpeg',
                quality: 1,
                margin: 1
              }
              qrcode.toDataURL(JSONobject, opts)
                .then(url => {
                  cloudinary.uploader.upload(url, (result, error) => {
                    if (result) {
                      user.qrcode.id = result.public_id;
                      user.qrcode.url = result.url;
                      user.save();
                    } else if (error) {
                      console.log("QR Code is not Uploaded!");
                    }
                  });
                })
                .catch(err => {
                  console.error(err)
                })
            }
            const token = jwt.sign(
              {
                type: "user",
                data: {
                  _id: user._id,
                  name: user.name,
                  email: user.email,
                  contact: user.contact,
                  role: user.role
                }
              },
              process.env.SECRET,
              {
                expiresIn: 604800 // for 1 week time in seconds
              }
            );
            res
              .header("x-auth-token", token)
              .status(200)
              .json({
                success: true,
                message: "Contact Verified. You can login now!",
                token: token
              });
          } else if (
            user.otpExpiresIn >= Date.now() &&
            user.isEmailVerified === false
          ) {
            user.isContactVerified = true;
            user.otpExpiresIn = undefined;
            await user.save();
            if (user.verifyEmail.expiresIn >= Date.now()) {
              res.status(200).json({
                success: true,
                message: "Contact Verified. Need to verify your Email!"
              });
            } else {
              await sendVerificationLink(user.email);
              res.status(200).json({
                success: true,
                message: "Contact Verified. Need to verify your Email now!"
              });
            }
          }
        }
        if (data.type == "error") {
          if (user.otpExpiresIn < Date.now())
            await sendOtpToMobile(user);
          res.status(400).json({ message: "Invalid Request or Link Expired!" });
        }
      });
    }
  } else {
    res.status(400).json({ message: "No User Found" });
  }
};

module.exports.retryContactVerification = async (req, res) => {
  let { contact } = req.params;
  contact = "+91" + contact;
  let user = await User.findOne({ contact: contact });
  if (user) {
    if (user.isContactVerified === true && user.isEmailVerified === true) {
      if (!user.qrcode.id) {
        let user1 = {
          _id: undefined,
          name: undefined,
          email: undefined,
          role: undefined,
          contact: undefined
        };
        user1._id = user._id;
        user1.name = user.name;
        user1.email = user.email;
        user1.role = user.role;
        user1.contact = user.contact;
        let JSONobject = JSON.stringify(user1);
        var opts = {
          errorCorrectionLevel: 'H',
          type: 'image/jpeg',
          quality: 1,
          margin: 1
        }
        qrcode.toDataURL(JSONobject, opts)
          .then(url => {
            cloudinary.uploader.upload(url, (result, error) => {
              if (result) {
                user.qrcode.id = result.public_id;
                user.qrcode.url = result.url;
                user.save();
              } else if (error) {
                console.log("QR Code is not Uploaded!");
              }
            });
          })
          .catch(err => {
            console.error(err)
          })
      }
      const token = jwt.sign(
        {
          type: "user",
          data: {
            _id: user._id,
            name: user.name,
            email: user.email,
            contact: user.contact,
            role: user.role
          }
        },
        process.env.SECRET,
        {
          expiresIn: 604800 // for 1 week time in seconds
        }
      );
      res
        .header("x-auth-token", token)
        .status(200)
        .json({
          success: true,
          message: "Already Verified!",
          token: token
        });
    } else if (user.isContactVerified === true) {
      if (user.verifyEmail.expiresIn >= Date.now())
        res.status(200).json({
          success: true,
          message: "Contact Already Verified! Need to verify Email Id."
        });
      else {
        sendVerificationLink(user.email);
        res.status(200).json({
          success: true,
          message: "Contact Already Verified! Need to verify Email Id now."
        });
      }
    } else {
      let response = await axios.post(
        `${process.env.MSG91_RESENDOTP_URL}${contact}&authkey=${process.env.MSG91_API_KEY}`
      );
      console.log(response);
      if (
        response.data.type === "error" &&
        response.data.message === "No OTP request found to retryotp"
      ) {
        res
          .status(400)
          .json({ message: "Can't retry OTP without trying Verification" });
      } else if (
        response.data.type === "success" &&
        user.isEmailVerified === false
      ) {
        if (user.verifyEmail.expiresIn >= Date.now())
          res.status(200).json({
            success: true,
            message: "Called! Need to verify Email Id."
          });
        else if (response.data.type === "success") {
          sendVerificationLink(user.email);
          res.status(200).json({
            success: true,
            message: "Called! Need to verify Email Id now."
          });
        }
      } else if (response.data.type === "error") {
        res.status(400).json({ message: "OTP not sent" });
      } else {
        res.status(200).json({
          success: true,
          message: "Otp Send via call."
        });
      }
    }
  } else {
    res.status(400).json({ message: "No User Found" });
  }
};

module.exports.profile = async (req, res) => {
  let user = await User.findById(req.user.data._id);
  id = user._id;
  isEmailVerified = user.isEmailVerified;
  isContactVerified = user.isContactVerified;
  name = user.name;
  email = user.email;
  contact = user.contact;
  role = user.role;
  qr = user.qrcode.url;
  referral_code = user.referral_code;
  bonus = user.bonus;
  return res.status(200).json({
    _id: id,
    isEmailVerified: isEmailVerified,
    isContactVerified: isContactVerified,
    name: name,
    email: email,
    contact: contact,
    role: role,
    qrcode: qr,
    referral_code: referral_code,
    bonus: bonus
  });
}

module.exports.update = async (req, res) => {
  let { name, email, contact } = req.body;
  let user = await User.findById(req.user.data._id);
  if (user) {
    let flag = false, flag1 = false;
    if (name === user.name && user.email === email && user.contact === contact)
      return res.status(400).json({ message: "Entries can't be same!" });
    if (!(user.email === email)) {
      await sendVerificationLink(email);
      user.isEmailVerified = false;
      user.email = email;
      flag1 = true;
    }
    if (!(user.contact === contact)) {
      user.contact = contact;
      user.isContactVerified = false;
      await user.save();
      await sendOtpToMobile(user);
      flag = true;
    }
    if (!(user.name === name)) {
      user.name = name;
    }
    await user.save();
    let user1 = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      contact: user.contact
    };
    let JSONobject = JSON.stringify(user1);
    var opts = {
      errorCorrectionLevel: 'H',
      type: 'image/jpeg',
      quality: 1,
      margin: 1
    }
    qrcode.toDataURL(JSONobject, opts)
      .then(url => {
        cloudinary.uploader.upload(url, (result, error) => {
          if (result) {
            user.qrcode.id = result.public_id;
            user.qrcode.url = result.url;
            user.save();
          } else if (error) {
            console.log("QR Code is not Uploaded!");
          }
        });
      })
      .catch(err => {
        console.error(err)
      })
    if (flag || flag1)
      return res.status(200).json({ contact: flag, message: "Profile updated! Need to verify in order to login successfully next time!" });
    return res.status(200).json({ message: "Profile updated!" });
  }
  else {
    return res.status(400).json({ message: "No such User!" });
  }
}

module.exports.sendForgetEmail = async (req, res) => {
  let { emailormobile } = req.params;
  let phoneRegex = /^([0|\+[0-9]{1,5})?([6-9][0-9]{9})$/;
  if (phoneRegex.test(emailormobile))
    emailormobile = "+91" + emailormobile;
  let user = await User.findOne({ $or: [{ email: emailormobile }, { contact: emailormobile }] });
  if (user) {
    if (user.isContactVerified === true && user.isEmailVerified === true) {
      if (!user.resetPwd.token || user.resetPwd.expiresIn < Date.now()) {
        forgetPasswordEmail(user.email);
        return res.status(200).json({ message: "Forget Password Email Sent!" });
      } else return res.status(400).json({ message: "Already Availed!" });
    } else if (
      user.isContactVerified === true &&
      user.isEmailVerified === false
    ) {
      if (user.verifyEmail.expiresIn >= Date.now())
        return res.status(200).json({
          message: "Verify your email Id first."
        });
      else {
        await sendVerificationLink(user.email);
        return res.status(200).json({
          message: "Verify your email Id first now."
        });
      }
    } else if (
      user.isEmailVerified === true &&
      user.isContactVerified === false
    ) {
      if (user.otpExpiresIn >= Date.now())
        return res.status(200).json({
          message: "Verify your Mobile No. first."
        });
      else {
        await sendOtpToMobile(user);
        return res.status(200).json({
          message: "Verify your Mobile No. first now."
        });
      }
    } else {
      if (
        user.verifyEmail.expiresIn >= Date.now() &&
        user.otpExpiresIn >= Date.now()
      )
        return res.status(200).json({
          message: "Verify your email Id first & Mobile No."
        });
      else if (
        user.verifyEmail.expiresIn < Date.now() &&
        user.otpExpiresIn >= Date.now()
      ) {
        await sendVerificationLink(user.email);
        return res.status(200).json({
          message: "Verify your email Id first now & Mobile No."
        });
      } else if (
        user.verifyEmail.expiresIn >= Date.now() &&
        user.otpExpiresIn < Date.now()
      ) {
        await sendOtpToMobile(user);
        return res.status(200).json({
          message: "Verify your email Id first & Mobile No. now"
        });
      } else {
        await sendVerificationLink(user.email);
        await sendOtpToMobile(user);
        return res.status(200).json({
          message: "Verify your email Id first now and Mobile No. now"
        });
      }
    }
  } else {
    return res.status(400).json({ message: "No User Found" });
  }
};

module.exports.forgetPassword = async (req, res) => {
  let { emailormobile } = req.params;
  let { newPassword, confirmPassword } = req.body;
  let phoneRegex = /^([0|\+[0-9]{1,5})?([6-9][0-9]{9})$/;
  if (phoneRegex.test(emailormobile))
    emailormobile = "+91" + emailormobile;
  let user = await User.findOne({ $or: [{ email: emailormobile }, { contact: emailormobile }] });
  if (user) {
    if (
      !user.isEmailVerified &&
      !user.isContactVerified &&
      user.otpExpiresIn >= Date.now() &&
      user.verifyEmail.expiresIn >= Date.now()
    )
      res.status(400).json({ message: "Get yourself verified!" });
    else if (
      !user.isEmailVerified &&
      !user.isContactVerified &&
      user.otpExpiresIn < Date.now() &&
      user.verifyEmail.expiresIn < Date.now()
    ) {
      await sendVerificationLink(user.email);
      await sendOtpToMobile(user);
      res.status(400).json({
        message: "Verify your email Id & Contact No now."
      });
    } else if (!user.isEmailVerified) {
      if (user.verifyEmail.expiresIn >= Date.now())
        res.status(400).json({
          message: "Verify your email Id first."
        });
      else {
        await sendVerificationLink(user.email);
        res.status(400).json({
          message: "Verify your email Id first now."
        });
      }
    } else if (!user.isContactVerified) {
      if (user.otpExpiresIn >= Date.now())
        res.status(400).json({
          message: "Verify your Mobile No. first."
        });
      else {
        await sendOtpToMobile(user);
        res.status(400).json({
          message: "Verify your Mobile No. first now."
        });
      }
    } else {
      if (newPassword === confirmPassword) {
        if (await bcrypt.compare(newPassword, user.password))
          return res.status(400).json({
            message:
              "Password stored with us and your entered passwords are same!"
          });
        const salt = await bcrypt.genSalt(10);
        newPassword = await bcrypt.hash(newPassword, salt);
        await User.updateOne(
          { _id: user.id },
          {
            $set: {
              password: newPassword,
              resetPwd: { token: undefined, expiresIn: undefined }
            }
          }
        );
        return res
          .status(200)
          .json({ message: "Password Reset Successfully!" });
      } else {
        return res
          .status(400)
          .json({ message: "Password and Confirm Password doesn't Match!" });
      }
    }
  } else {
    return res.status(400).json({ message: "No such User!" });
  }
};

module.exports.deleteUser = async (req, res) => {
  let user = await User.findById(req.params.id);
  if (user) {
    await mailToDeletedUsers(user.email);
    await User.deleteOne({ _id: req.params.id });
    res.status(200).json({ message: "Deleted Successfully!" });
  } else {
    res.status(400).json({ message: "No such User!" });
  }
};