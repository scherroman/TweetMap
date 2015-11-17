var r = require('rethinkdb');

var connection = null;
r.connect( {host: 'localhost', port: 28015}, function(err, conn) {
	if (err) throw err;
	connection = conn;

    //Create a database
	r.dbCreate('NodeTweet').run(connection, function(err, result) {
		if (err) {
			console.log("Error: " + err);
			console.log("Database probably already exists");
			process.exit();
		}
		else {
			console.log("Creating database");
			console.log(JSON.stringify(result, null, 2));

			//Add a table:
			r.db('NodeTweet').tableCreate('tweets', {shards:8, replicas:3}).run(connection, function(err, result) {
				if (err) throw err;
				console.log(JSON.stringify(result, null, 2));
				//Add a table:
				r.db('NodeTweet').tableCreate('terms', {shards:8, replicas:3}).run(connection, function(err, result) {
					if (err) throw err;
					console.log(JSON.stringify(result, null, 2));
					process.exit();
				})
			})
		}
	})
})




