yaml = require('js-yaml');
fs = require('fs');

// database is let instead of const to allow us to modify it in test.js
let database = {
  users: {},
  articles: {},
  comments: {},
  nextArticleId: 1,
  nextCommentId: 1
};

const routes = {
  '/users': {
    'POST': getOrCreateUser
  },
  '/users/:username': {
    'GET': getUser
  },
  '/articles': {
    'GET': getArticles,
    'POST': createArticle
  },
  '/articles/:id': {
    'GET': getArticle,
    'PUT': updateArticle,
    'DELETE': deleteArticle
  },
  '/articles/:id/upvote': {
    'PUT': upvoteArticle
  },
  '/articles/:id/downvote': {
    'PUT': downvoteArticle
  },
  //comment handler
  '/comments':{
    'POST': createComment
  },
  '/comments/:id': {
    'PUT': updateComment,
    'DELETE': deleteComment
  },
  '/comments/:id/upvote': {
    'PUT': upvoteComment
  },
  '/comments/:id/downvote': {
    'PUT': downvoteComment
  }
};

//handler functions
function getUser(url, request) {
  const username = url.split('/').filter(segment => segment)[1];
  const user = database.users[username];
  const response = {};

  if (user) {
    const userArticles = user.articleIds.map(
        articleId => database.articles[articleId]);
    const userComments = user.commentIds.map(
        commentId => database.comments[commentId]);
    response.body = {
      user: user,
      userArticles: userArticles,
      userComments: userComments
    };
    response.status = 200;
  } else if (username) {
    response.status = 404;
  } else {
    response.status = 400;
  }

  return response;
}

function getOrCreateUser(url, request) {
  const username = request.body && request.body.username;
  const response = {};

  if (database.users[username]) {
    response.body = {user: database.users[username]};
    response.status = 200;
  } else if (username) {
    const user = {
      username: username,
      articleIds: [],
      commentIds: []
    };
    database.users[username] = user;

    response.body = {user: user};
    response.status = 201;
  } else {
    response.status = 400;
  }

  return response;
}

function getArticles(url, request) {
  const response = {};

  response.status = 200;
  response.body = {
    articles: Object.keys(database.articles)
        .map(articleId => database.articles[articleId])
        .filter(article => article)
        .sort((article1, article2) => article2.id - article1.id)
  };

  return response;
}

function getArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const article = database.articles[id];
  const response = {};

  if (article) {
    article.comments = article.commentIds.map(
      commentId => database.comments[commentId]);

    response.body = {article: article};
    response.status = 200;
  } else if (id) {
    response.status = 404;
  } else {
    response.status = 400;
  }

  return response;
}

function createArticle(url, request) {
  //create variables containing article submitted and response
  const requestArticle = request.body && request.body.article;
  const response = {};

  //if all fields of article submission are filled and valid user
  if (requestArticle && requestArticle.title && requestArticle.url &&
      requestArticle.username && database.users[requestArticle.username]) {

  //create new article object
    const article = {
      id: database.nextArticleId++,
      title: requestArticle.title,
      url: requestArticle.url,
      username: requestArticle.username,
      commentIds: [],
      upvotedBy: [],
      downvotedBy: []
    };

    //add article to database at article.id
    database.articles[article.id] = article;
    //add article to array of users articles
    database.users[article.username].articleIds.push(article.id);

    //add article and code to response
    response.body = {article: article};
    response.status = 201;
  } else {
    response.status = 400; //bad request
  }
  //done
  return response;
}

function updateArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const savedArticle = database.articles[id];
  const requestArticle = request.body && request.body.article;
  const response = {};

  if (!id || !requestArticle) {
    response.status = 400;
  } else if (!savedArticle) {
    response.status = 404;
  } else {
    savedArticle.title = requestArticle.title || savedArticle.title;
    savedArticle.url = requestArticle.url || savedArticle.url;

    response.body = {article: savedArticle};
    response.status = 200;
  }

  return response;
}

function deleteArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const savedArticle = database.articles[id];
  const response = {};

  if (savedArticle) {
    database.articles[id] = null;
    savedArticle.commentIds.forEach(commentId => {
      const comment = database.comments[commentId];
      database.comments[commentId] = null;
      const userCommentIds = database.users[comment.username].commentIds;
      userCommentIds.splice(userCommentIds.indexOf(id), 1);
    });
    const userArticleIds = database.users[savedArticle.username].articleIds;
    userArticleIds.splice(userArticleIds.indexOf(id), 1);
    response.status = 204;
  } else {
    response.status = 400;
  }

  return response;
}

function upvoteArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const username = request.body && request.body.username;
  let savedArticle = database.articles[id];
  const response = {};

  if (savedArticle && database.users[username]) {
    savedArticle = upvote(savedArticle, username);

    response.body = {article: savedArticle};
    response.status = 200;
  } else {
    response.status = 400;
  }

  return response;
}

function downvoteArticle(url, request) {
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const username = request.body && request.body.username;
  let savedArticle = database.articles[id];
  const response = {};

  if (savedArticle && database.users[username]) {
    savedArticle = downvote(savedArticle, username);

    response.body = {article: savedArticle};
    response.status = 200;
  } else {
    response.status = 400;
  }

  return response;
}

function upvote(item, username) {
  if (item.downvotedBy.includes(username)) {
    item.downvotedBy.splice(item.downvotedBy.indexOf(username), 1);
  }
  if (!item.upvotedBy.includes(username)) {
    item.upvotedBy.push(username);
  }
  return item;
}

function downvote(item, username) {
  if (item.upvotedBy.includes(username)) {
    item.upvotedBy.splice(item.upvotedBy.indexOf(username), 1);
  }
  if (!item.downvotedBy.includes(username)) {
    item.downvotedBy.push(username);
  }
  return item;
}

//stuff I wrote V V V
function createComment(url, request)
{
  const response = {};

  //if valid request from valid user on valid article
  if(request.body && request.body.comment && request.body.comment.body &&
    database.users[request.body.comment.username] &&
  database.articles[request.body.comment.articleId])
  {
    //create new comment
    const comment =
    {
      id: database.nextCommentId++,
      body: request.body.comment.body,
      username: request.body.comment.username,
      articleId: request.body.comment.articleId,
      upvotedBy: [],
      downvotedBy: []
    }

    //add comment to article, database, and user
    database.articles[comment.articleId].commentIds.push(comment.id);
    database.comments[comment.id] = comment;
    database.users[comment.username].commentIds.push(comment.id);

    //format response
    response.body = {comment: comment};
    response.status = 201;
  }
  else //not a valid request
  {
      response.status = 400;
  }

  return response;

};

function updateComment(url, request)
{
  //get id number from url
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const response = {};

  //if valid request on valid comment with changes
  if(request.body && request.body.comment &&
    request.body.comment.body && database.comments[id] &&
    request.body.comment.body !== database.comments[id])
  {
    //change database entry
    database.comments[id].body = request.body.comment.body;

    //format response
    response.body = {comment: database.comments[id]};
    response.status = 200;
  }
  else if(!database.comments[id]) //if comment doesn't exist
  {
    response.status = 404;
  }
  else //bad request
  {
    response.status = 400;
  }

  return response;
};

function upvoteComment(url, request)
{
  //get id from url
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const response = {};

  //if valid request on valid comment from valid user
  if(request.body && id && database.comments[id] &&
    database.users[request.body.username])
  {
    //upvote comment
    database.comments[id] = upvote(database.comments[id], request.body.username)

    //format response
    response.body = {comment: database.comments[id]};
    response.status = 200;
  }
  else //bad request
  {
    response.status = 400;
  }

  return response;
};

function downvoteComment(url, request)
{
  //get id from url
  const id = Number(url.split('/').filter(segment => segment)[1]);
  const response = {};

  //if valid request from valid user on valid comment
  if(request.body && id && database.comments[id] &&
     database.users[request.body.username])
  {
    //downvote comment
    database.comments[id] = downvote(database.comments[id], request.body.username)

    //format repsonse
    response.body = {comment: database.comments[id]};
    response.status = 200;
  }
  else //bad request
  {
    response.status = 400;
  }

  return response;
};

function deleteComment(url, request)
{
    //get id from url and save comment for convenience
    const id = Number(url.split('/').filter(segment => segment)[1]);
    const savedComment = database.comments[id];

    const response = {};

    //if comment exist
    if(id && savedComment)
    {
      //delete comment
      database.comments[id] = null;

      //delete comment from user
      const userCommentIds = database.users[savedComment.username].commentIds;
      userCommentIds.splice(userCommentIds.indexOf(id), 1);

      //delete comment from article
      const articleCommentIds = database.articles[savedComment.articleId].commentIds;
      articleCommentIds.splice(articleCommentIds.indexOf(id), 1) ;

      //format response
      response.status = 204;
    }
    else //comment not found
    {
      response.status = 404;
    }

    return response;
};

function loadDatabase()
{
  try
  {
    database = yaml.safeLoad(fs.readFileSync('database.yml'), function(err)
    {
      if(err)
      {
        throw err;
      }
    });
  }
  catch(e)
  {
    console.log(e);
  }
}

function saveDatabase()
{
  try
  {
      fs.writeFile('database.yml', yaml.safeDump(database), function (err)
    {
      if(err)
      {
        throw err;
      }
    });
  }
  catch (e)
  {
    console.log(e);
  }
}

// Write all code above this line.

const http = require('http');
const url = require('url');

const port = process.env.PORT || 4000;
const isTestMode = process.env.IS_TEST_MODE;

const requestHandler = (request, response) => {
  const url = request.url;
  const method = request.method;
  const route = getRequestRoute(url);

  if (method === 'OPTIONS') {
    var headers = {};
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
    headers["Access-Control-Allow-Credentials"] = false;
    headers["Access-Control-Max-Age"] = '86400'; // 24 hours
    headers["Access-Control-Allow-Headers"] = "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept";
    response.writeHead(200, headers);
    return response.end();
  }

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.setHeader(
      'Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  if (!routes[route] || !routes[route][method]) {
    response.statusCode = 400;
    return response.end();
  }

  if (method === 'GET' || method === 'DELETE') {
    const methodResponse = routes[route][method].call(null, url);
    !isTestMode && (typeof saveDatabase === 'function') && saveDatabase();

    response.statusCode = methodResponse.status;
    response.end(JSON.stringify(methodResponse.body) || '');
  } else {
    let body = [];
    request.on('data', (chunk) => {
      body.push(chunk);
    }).on('end', () => {
      body = JSON.parse(Buffer.concat(body).toString());
      const jsonRequest = {body: body};
      const methodResponse = routes[route][method].call(null, url, jsonRequest);
      !isTestMode && (typeof saveDatabase === 'function') && saveDatabase();

      response.statusCode = methodResponse.status;
      response.end(JSON.stringify(methodResponse.body) || '');
    });
  }
};

const getRequestRoute = (url) => {
  const pathSegments = url.split('/').filter(segment => segment);

  if (pathSegments.length === 1) {
    return `/${pathSegments[0]}`;
  } else if (pathSegments[2] === 'upvote' || pathSegments[2] === 'downvote') {
    return `/${pathSegments[0]}/:id/${pathSegments[2]}`;
  } else if (pathSegments[0] === 'users') {
    return `/${pathSegments[0]}/:username`;
  } else {
    return `/${pathSegments[0]}/:id`;
  }
}

if (typeof loadDatabase === 'function' && !isTestMode) {
  const savedDatabase = loadDatabase();
  if (savedDatabase) {
    for (key in database) {
      database[key] = savedDatabase[key] || database[key];
    }
  }
}

const server = http.createServer(requestHandler);

server.listen(port, (err) => {
  if (err) {
    return console.log('Server did not start succesfully: ', err);
  }

  console.log(`Server is listening on ${port}`);
});
