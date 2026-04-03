const protect = (req, res, next) => {
  next();
};

const adminOnly = (req, res, next) => {
  next();
};

export { protect, adminOnly };


