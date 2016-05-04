#!/usr/bin/env node
var gulp = require('gulp');
var gutil = require('gulp-util');
var webpack = require('webpack');
var path = require('path');
var fs = require('fs');
var nodemon = require('nodemon');
var webpackConfig = require('./webpack-config');
var configure = require('./argparser');
var ON_DEATH = require('death')

function importantLog(str){
  gutil.log(gutil.colors.bgMagenta(" ") + " " + gutil.colors.bold(str))
}

// tasks
function onBuild(err, stats) {
    if(err) {
      console.log('Error', err);
    }
    console.log(stats.toString({colors: true}));
}
function onFirstBuild(done) {
    return function(err,stats){
        onBuild(err,stats)
        done()
    }
}

function logImportantFromToAction(acting, configuration, color){
    color = color || 'cyan'
    importantLog(acting + " from '" + gutil.colors[color](configuration.entry) + "' to '" + gutil.colors[color](configuration.out) + "'")
}


function endWatch(watcher) {
    watcher.close(function(){
        logImportantFromToAction("stopped compiling", watcher._polypackConfiguration, 'magenta')
        watching.count -= 1
        if(!watching.count){
            importantLog('all watchers stopped. Polypacker exited cleanly')
            process.exit(0)
        }
    })
}


var wrapper = configure()
var configurations = wrapper.config.compilers
var selectedTask = wrapper.config.task
var watching = {
    count: 0,
    compilers: []
}

function compileForAllConfigurations(done){
  var firedDone = false
  configurations.map(function(configuration){
      logImportantFromToAction("distributing", configuration)
      webpack(webpackConfig(configuration)).run(function(err,stats){
          if(!firedDone) {
              firedDone = true
              onFirstBuild(done)(err, stats)
          } else {
              onBuild(err, stats)
          }
      })
  })
}

var contextWatchActions = {
    NODE: function(configuration){
        if(configuration.watch && configuration.run)
            nodemon.restart();
    }
}

function watchAllConfigurations(done){
  var firedDone = false;
  watching.compilers = configurations.map(function(configuration){
      logImportantFromToAction("watching and distributing", configuration)
      var watcher = webpack(webpackConfig(configuration)).watch(250, function(err, stats) {
          if(!firedDone) {
              firedDone = true;
              onFirstBuild(done)(err, stats)
          } else {
              onBuild(err, stats)
          }
          if(contextWatchActions[configuration.context]){
              contextWatchActions[configuration.context](configuration)
          }
      })
      watcher._polypackConfiguration = configuration
      watching.count += 1
      return watcher
  })
}


function runSelectedContext(){
  configurations.map(function(configuration){
      if(configuration.run){
          importantLog("runnning " + gutil.colors.cyan(configuration.context) + " context from " +  gutil.colors.cyan(configuration.out))
          nodemon({
              execMap: {
                  js: 'node'
              },
              script: path.join(process.env.PWD, configuration.out),
              args: wrapper.unknown,
              ignore: ['*'],
              watch: ['nothing/'],
              ext: 'noop'
          }).on('restart', function() {
              importantLog('Patched!')
          })
      }
  })
}

gulp.task('dist', compileForAllConfigurations)
gulp.task('watch', watchAllConfigurations)
gulp.task('run', ['dist'], runSelectedContext);
gulp.task('watch-and-run', ['watch'], runSelectedContext);

if (require.main === module) {
    gulp.start(selectedTask)
}

ON_DEATH(function(signal, err) {
    if(watching.count){
        console.log('\n')
        importantLog('stopping watchers.')
        watching.compilers.map(endWatch)
    } else {
        importantLog('Polypacker exited cleanly.')
    }
})
