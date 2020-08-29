import { bindable } from 'aurelia-framework'
import { HeaderData } from './app'

export class ConversationHeader {
    @bindable
    headerData: HeaderData
}
