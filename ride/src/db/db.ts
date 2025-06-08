import mongoose from 'mongoose';

function connect(): void {
    mongoose.connect(process.env.MONGO_URL as string)
        .then(() => {
            console.log('ride service connected to MongoDB');
        })
        .catch((err: Error) => {
            console.log(err);
        });
}

export default connect;
