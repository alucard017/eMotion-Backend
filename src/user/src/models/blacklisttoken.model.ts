import mongoose, { Document, Schema } from 'mongoose';

interface IBlacklistToken extends Document {
    token: string;
    createdAt: Date;
}

const blacklistTokenSchema = new Schema<IBlacklistToken>({
    token: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 3600 // 1 hour in seconds
    }
}, {
    timestamps: true
});

const BlacklistToken = mongoose.model<IBlacklistToken>('BlacklistToken', blacklistTokenSchema);

export default BlacklistToken;
