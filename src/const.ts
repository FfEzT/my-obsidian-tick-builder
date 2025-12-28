import { CalendarEventPluginSettings, EventType } from "./types";

export const PLUGIN_NAME = "MyTicker";

export const DEFAULT_SETTINGS: CalendarEventPluginSettings = {
    type: EventType.TICK,

    prefixName: '',
    recurrenceInterval: 1,

    timeStart: '7h',
    timeDuration: '1h',

    noteData: {
        dateField: 'date',
        timeField: 'time',
        durationField: 'duration'
    }
}
