require('traceur-runtime');

var Config = require('../build/config').default;
var assert = require('chai').assert;
var path = require('path');
var fs = require('fs');

//It is important for these tests that you run them via `npm test` in the root dir.
var config = new Config('test/zygo.json');

describe("config.js tests", function() {
  it("correctly expands package path", function() {
    assert.equal(config.configPath, path.join(__dirname, 'zygo.json'));
  });

  describe("parse()", function() {
    before(function(done) {
      config.parse().then(done).catch(done);
    });

    it("should load template file", function () {
      var template = fs.readFileSync(path.join(__dirname, 'template.hbs'), "utf-8");
      assert(config.config.template, "config has loaded something into config.template");
      assert.equal(config.config.template, template,'it is the right something');
    });

    it("should load route files", function() {
      var files = {
        routes: 'routes/routes.json',
        clientRoutes: 'routes/clientRoutes.json',
        serverRoutes: 'routes/serverRoutes.json'
      };

      var key;
      for (key in files) files[key] = path.join(__dirname, files[key]);
      for (key in files) files[key] = fs.readFileSync(files[key], 'utf-8');
      for (key in files) files[key] = JSON.parse(files[key]);

      for (key in files) {
        assert(config.config[key], key + " has had something loaded into it by config");
        assert.deepEqual(config.config[key], files[key], key + " is loaded by config correctly");
      }
    });
  });
});
