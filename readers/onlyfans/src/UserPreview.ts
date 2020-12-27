import { User } from './Feed';
import { bindable } from 'aurelia-framework'

export class UserPreview {
    @bindable
    user: User
}
