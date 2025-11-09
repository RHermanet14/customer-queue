DROP TABLE IF EXISTS customer;
CREATE TABLE customer (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(32),
    location VARCHAR(32) NOT NULL CHECK (location in ('Computers', 'Applicances', 'Home Audio', 'Printers')),
    queue_position INT,
    add_time TIMESTAMP DEFAULT NOW(),
    remove_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
);