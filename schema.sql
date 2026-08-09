CREATE TABLE calm_place_suggestion (
	suggestion_id SERIAL NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	category VARCHAR(80) NOT NULL, 
	address VARCHAR(200), 
	latitude FLOAT, 
	longitude FLOAT, 
	note VARCHAR(300), 
	status VARCHAR(20) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	PRIMARY KEY (suggestion_id)
);

CREATE TABLE refuge (
	refuge_id SERIAL NOT NULL, 
	tier INTEGER NOT NULL, 
	name VARCHAR(200) NOT NULL, 
	category VARCHAR(80) NOT NULL, 
	source_dataset VARCHAR(120) NOT NULL, 
	latitude FLOAT NOT NULL, 
	longitude FLOAT NOT NULL, 
	wheelchair VARCHAR(10), 
	PRIMARY KEY (refuge_id)
);

CREATE TABLE sensor_location (
	location_id SERIAL NOT NULL, 
	sensor_description VARCHAR(120), 
	sensor_name VARCHAR(60), 
	installation_date DATE, 
	location_type VARCHAR(30), 
	status VARCHAR(10), 
	direction_1 VARCHAR(30), 
	direction_2 VARCHAR(30), 
	latitude FLOAT NOT NULL, 
	longitude FLOAT NOT NULL, 
	PRIMARY KEY (location_id)
);

CREATE TABLE sensory_source (
	source_id SERIAL NOT NULL, 
	kind VARCHAR(30) NOT NULL, 
	name VARCHAR(200), 
	latitude FLOAT NOT NULL, 
	longitude FLOAT NOT NULL, 
	weight FLOAT NOT NULL, 
	PRIMARY KEY (source_id)
);

CREATE TABLE hourly_profile (
	location_id INTEGER NOT NULL, 
	weekday INTEGER NOT NULL, 
	hour INTEGER NOT NULL, 
	avg_count FLOAT NOT NULL, 
	sample_days INTEGER NOT NULL, 
	PRIMARY KEY (location_id, weekday, hour), 
	FOREIGN KEY(location_id) REFERENCES sensor_location (location_id)
);

CREATE TABLE pedestrian_hour_count (
	location_id INTEGER NOT NULL, 
	sensing_date DATE NOT NULL, 
	hour INTEGER NOT NULL, 
	direction_1 INTEGER, 
	direction_2 INTEGER, 
	pedestrian_count INTEGER, 
	PRIMARY KEY (location_id, sensing_date, hour), 
	FOREIGN KEY(location_id) REFERENCES sensor_location (location_id)
);

CREATE TABLE pedestrian_minute_count (
	location_id INTEGER NOT NULL, 
	sensing_datetime TIMESTAMP WITHOUT TIME ZONE NOT NULL, 
	direction_1 INTEGER, 
	direction_2 INTEGER, 
	total_of_directions INTEGER, 
	PRIMARY KEY (location_id, sensing_datetime), 
	FOREIGN KEY(location_id) REFERENCES sensor_location (location_id)
);

CREATE TABLE venue_hours (
	id SERIAL NOT NULL, 
	refuge_id INTEGER NOT NULL, 
	day_of_week INTEGER NOT NULL, 
	open_time VARCHAR(5), 
	close_time VARCHAR(5), 
	source VARCHAR(200), 
	verified_date DATE, 
	PRIMARY KEY (id), 
	FOREIGN KEY(refuge_id) REFERENCES refuge (refuge_id)
);