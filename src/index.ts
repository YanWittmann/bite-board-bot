import {
    HochschuleMannheimTagessichtMenuProvider
} from "./service/menu/providers/HochschuleMannheimTagessichtMenuProvider.js";
import { BiteBoardBot } from "./BiteBoardBot.js";

new BiteBoardBot([new HochschuleMannheimTagessichtMenuProvider()]);
