module.exports = function(grunt) {

	grunt.initConfig({
		jshint: {
			files: ['*.js', 'lib/**/*.js', 'plugins/**/*.js'],
			options: {
				jshintrc: true
			}
		},

		jscs: {
			files: ['<%= jshint.files %>'],
			options: {
				config: true
			}
		},

		watch: {
			js: {
				files: ['<%= jshint.files %>'],
				tasks: ['jscs', 'jshint']
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-jscs');

	grunt.registerTask('default', ['jshint', 'jscs']);
};
