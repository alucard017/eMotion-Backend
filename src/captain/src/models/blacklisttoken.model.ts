import mongoose, { Schema, Document } from 'mongoose';

interface IBlacklistToken extends Document {
    token: string;
    createdAt: Date;
}

const blacklistTokenSchema = new Schema<IBlacklistToken>(
    {
        token: {
            type: String,
            required: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
            expires: 3600, // 1 hour in seconds
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.model<IBlacklistToken>('BlacklistToken', blacklistTokenSchema);
