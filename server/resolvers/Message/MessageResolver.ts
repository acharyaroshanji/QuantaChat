/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {
  Resolver,
  Query,
  Mutation,
  FieldResolver,
  Root,
  Arg,
  Ctx,
  Authorized,
} from 'type-graphql';
import { ApolloError } from 'apollo-server-express';
import Message, { MessageClass } from '../../entities/Message';
import User, { UserClass } from '../../entities/User';
import MessageInput from './MessageInput';
import { Context } from '../../Context';

@Resolver(() => MessageClass)
class MessageResolver {
  @Query(() => [MessageClass])
  async messages(): Promise<MessageClass[]> {
    return await Message.find({});
  }

  @Authorized()
  @Query(() => [MessageClass])
  async getMessage(
    @Arg('to') to: string,
    @Ctx() context: Context
  ): Promise<MessageClass[]> {
    try {
      return Message.find({ to, from: context.getUser()!._id });
    } catch (e) {
      throw new ApolloError(e);
    }
  }

  @Authorized()
  @Mutation(() => MessageClass)
  async createNewMessage(
    @Arg('data') { to, text }: MessageInput,
    @Ctx() context: Context
  ): Promise<MessageClass> {
    try {
      const message = new Message({ from: context.currentUser._id, to, text });
      await message.save();
      context.pubsub.publish('NEW_MESSAGE', message);
      return message;
    } catch (e) {
      throw new ApolloError(e);
    }
  }

  @Authorized()
  @Mutation(() => MessageClass)
  async updateMessage(
    @Arg('id') id: string,
    @Arg('text') text: string,
    @Ctx() context: Context
  ): Promise<MessageClass> {
    try {
      const updatedMessage = await Message.findOneAndUpdate(
        { _id: id, from: context.currentUser._id },
        { text },
        { new: true }
      );
      if (!updatedMessage) throw new ApolloError('Message not found');
      context.pubsub.publish('UPDATE_MESSAGE', updatedMessage);

      return updatedMessage;
    } catch (e) {
      throw new ApolloError(e);
    }
  }

  @Authorized()
  @Mutation(() => MessageClass)
  async deleteMessage(
    @Ctx() context: Context,
    @Arg('id') id: string
  ): Promise<MessageClass> {
    try {
      const message = await Message.findOneAndDelete({
        _id: id,
        from: context.currentUser._id,
      });
      if (!message) throw new ApolloError('Message not found');
      context.pubsub.publish('DELETE_MESSAGE', message);

      return message;
    } catch (e) {
      throw new ApolloError(e);
    }
  }

  @FieldResolver(() => UserClass)
  async from(@Root() parent: any): Promise<UserClass | null> {
    try {
      return await User.findById(parent.from);
    } catch (e) {
      throw new ApolloError(e);
    }
  }

  @FieldResolver(() => UserClass)
  async to(@Root() parent: any): Promise<UserClass | null> {
    try {
      return await User.findById(parent.to);
    } catch (e) {
      throw new ApolloError(e);
    }
  }
}

export default MessageResolver;
