# Bank Queue Management System

A real-time queue management system for banks to handle customer flow efficiently.

## Features

- **Customer Kiosk**: Customers can register and get queue numbers
- **Display Screen**: Shows current queue status and calls customers
- **Counter Management**: Staff interface to manage customer flow
- **Real-time Updates**: All screens sync instantly using WebSockets

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Access the interfaces:
- Login page: http://localhost:3000/login
- Customer Kiosk: http://localhost:3000
- Display Screen: http://localhost:3000/display
- Counter 1 (Account Opening): http://localhost:3000/counter/1
- Counter 2 (Loan Application): http://localhost:3000/counter/2
- Counter 3 (Money Transfer): http://localhost:3000/counter/3
- Counter 4 (Card Services): http://localhost:3000/counter/4
- Counter 5 (General Inquiry): http://localhost:3000/counter/5

## How it Works

1. **Customer Registration**: Customers enter their name and select a service at the kiosk
2. **Queue Management**: System assigns queue numbers and manages the waiting list
3. **Real-time Display**: All screens show current queue status and counter availability
4. **Customer Calling**: Staff can call next customer from their counter interface
5. **Synchronized Updates**: All displays update instantly when customers are called

## Services Available

- Account Opening
- Loan Application
- Money Transfer
- Card Services
- General Inquiry
- Other (specify)

## Counter Configuration

The system includes 5 dedicated service counters:
- Counter 1: Account Opening
- Counter 2: Loan Application
- Counter 3: Money Transfer
- Counter 4: Card Services
- Counter 5: General Inquiry + Other (specify) where the user gets to type in their inquiry

## Technology Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: HTML, CSS, JavaScript
- **Real-time**: WebSocket communication
- **Database**: MongoDB for persistent storage

## MongoDB Setup

1. Install MongoDB on your system or use MongoDB Atlas
2. Configure the connection string in the `.env` file
3. The system will automatically create the required collections

## Data Storage

The system stores the following information in MongoDB:

- **Tickets**: Customer information, service requested, wait time, service time
- **Counters**: Counter status, current ticket, total customers served
- **Users**: Bank staff accounts with role-based access control

## Authentication

The system includes role-based authentication:

- **Admin**: Full access to all features, including user management
- **Supervisor**: Access to display screen, counters, and ticket history
- **Employee**: Access to display screen and assigned counter

### Default Admin Account

A default admin account is created on first run:
- **Email**: admin@bankqueue.com
- **Password**: admin123

**Important**: Change the default password after first login!