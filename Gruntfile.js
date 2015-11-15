module.exports = function(grunt) {

    grunt.initConfig({
        jshint: {
            files: ['*.js', 'lib/**/*.js'],
            options: {
                jshintrc: true
            }
        },

        watch: {
            js: {
                files: ['<%= jshint.files %>'],
                tasks: ['jshint']
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('default', ['watch']);
};
