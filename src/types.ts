export type NoteField = {
    dateField: string;
    timeField: string;
    durationField: string;
}

export type CalendarEventPluginSettings = {
    type: EventType;

    prefixName: string
    recurrenceInterval: number

    timeStart: string
    timeDuration: string

    noteData: NoteField
}

export enum EventType {
    TICK,
    NOTE
}


export type ModelEventSettings = {
    settings: CalendarEventPluginSettings

    interval: {
        start: Date
        end: Date
    }
    periodicData: {
        days?: number[] // week: day: Mon, Tues...
        dates?: number[] // month: dates: 1, 2, 3
    }
}
