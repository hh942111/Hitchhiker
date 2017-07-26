var gulp = require('gulp'),
    clean = require('gulp-clean'),
    argv = require('yargs').argv,
    replace = require('gulp-replace'),
    exec = require('child_process').exec;

gulp.task('release', ['copy']);

gulp.task('copy', ['clean'], function () {
    return gulp.src('./client/build/**/*.*')
        .pipe(gulp.dest('./build/public'));
});

gulp.task('clean', argv.prod ? ['compilerClient'] : [], function () {
    return gulp.src('./build/public/*.*', {
            read: false
        })
        .pipe(clean());
});

gulp.task('compilerClient', ['config'], function (cb) {
    process.chdir('./client');
    exec('yarn build', function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        process.chdir('../');
        cb();
    });
});

gulp.task('config', ['compilerServer'], function () {
    console.log(`${argv.host}`);
    gulp.src('./client/src/utils/urls.ts')
        .pipe(replace('http://localhost:3000/', 'HITCHHIKER_APP_HOST'))
        .pipe(gulp.dest('./client/src/utils/'));
    gulp.src('./appconfig.json')
        .pipe(replace('localhost:3000', `localhost:${8080}`))
        .pipe(gulp.dest('./'));
});

gulp.task('compilerServer', [], function (cb) {
    exec('tsc -p . -w false', function (err, stdout, stderr) {
        console.log(stdout);
        console.log(stderr);
        cb();
    });
});