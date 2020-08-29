import { bindable } from 'aurelia-framework'
import { Messages } from './app'

export class MessagesGroup {
    @bindable
    messages: Messages
}
