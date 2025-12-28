import { CalendarEventPluginSettings, EventType, ModelEventSettings } from './types';
import { App, Modal,  Setting } from 'obsidian';
import moment from 'moment';


enum Periodic {
    WEEKLY,
    MONTHLY
}

export default class EventCreationModal extends Modal {
    onSubmit: (result: ModelEventSettings) => void;
    settings: CalendarEventPluginSettings;

    private periodicType: Periodic = Periodic.WEEKLY;

    constructor(app: App, settings: CalendarEventPluginSettings, onSubmit: (result: ModelEventSettings) => void) {
        super(app);
        this.settings = settings;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Create Calendar Events' });

        const resultData: ModelEventSettings = {
            settings: structuredClone(this.settings),
            interval: {
                start: moment().toDate(),
                end: moment().add(7, "d").toDate()
            },
            periodicData: {}
        };

        // Type selection
        new Setting(contentEl)
            .setName('Event Type')
            .setDesc('Select type of events to create')
            .addDropdown(dropdown => dropdown
                .addOption(EventType.TICK.toString(), 'Ticks (in current note)')
                .addOption(EventType.NOTE.toString(), 'Notes (separate files)')
                .setValue(resultData.settings.type.toString())
                .onChange(value => {
                    this.settings.type = parseInt(value);
                    this.onOpen();
                }));

        // Prefix Name
        new Setting(contentEl)
            .setName('Prefix Name')
            .setDesc('Base name for events (e.g., "meeting", "class")')
            .addText(text => text
                .setValue(resultData.settings.prefixName)
                .onChange(value => resultData.settings.prefixName = value)
            );

        // Start Time
        new Setting(contentEl)
            .setName('Start Time')
            .setDesc('Event start time (e.g., 12h, 12h30m)')
            .addText(text => text
                .setValue(resultData.settings.timeStart)
                .setPlaceholder('9h')
                .onChange(value => resultData.settings.timeStart = value));

        // Duration
        new Setting(contentEl)
            .setName('Duration')
            .setDesc('Event duration (e.g., 1h, 1h30m)')
            .addText(text => text
                .setValue(resultData.settings.timeDuration)
                .setPlaceholder('1h')
                .onChange(value => resultData.settings.timeDuration = value));

        // Note-specific fields (only shown when type is 'note')
        if (resultData.settings.type === EventType.NOTE) {
            new Setting(contentEl)
                .setName('Date Field Name')
                .setDesc('Field name for date in your note (e.g., "Date", "Meeting Date")')
                .addText(text => text
                    .setValue(resultData.settings.noteData.dateField)
                    .onChange(value => {
                        resultData.settings.noteData.dateField = value;
                    })
                );

            new Setting(contentEl)
                .setName('Time Field Name')
                .setDesc('Field name for time in your note (e.g., "Time", "Start Time")')
                .addText(text => text
                    .setValue(resultData.settings.noteData.timeField)
                    .onChange(value => {
                        resultData.settings.noteData.timeField = value;
                    })
                );

            new Setting(contentEl)
                .setName('Duration Field Name')
                .setDesc('Field name for duration in your note (e.g., "Duration", "Length")')
                .addText(text => text
                    .setValue(resultData.settings.noteData.durationField)
                    .onChange(value => {
                        resultData.settings.noteData.durationField = value;
                    })
                );
        }

        // Start Date
        const startDateSetting = new Setting(contentEl)
            .setName('Start Date')
            .setDesc('Select start date for events');

        const startDateContainer = startDateSetting.descEl.createDiv({ cls: 'date-picker-container' });
        const startDateInput = startDateContainer.createEl('input', {
            type: 'date',
            cls: 'date-picker'
        });
        startDateInput.value = moment(resultData.interval.start).format('YYYY-MM-DD');
        startDateInput.addEventListener('change', () => {
            resultData.interval.start = new Date(startDateInput.value);
        });

        // End Date
        const endDateSetting = new Setting(contentEl)
            .setName('End Date')
            .setDesc('Select end date for events');

        const endDateContainer = endDateSetting.descEl.createDiv({ cls: 'date-picker-container' });
        const endDateInput = endDateContainer.createEl('input', {
            type: 'date',
            cls: 'date-picker'
        });
        endDateInput.value = moment(resultData.interval.end).format('YYYY-MM-DD');
        endDateInput.addEventListener('change', () => {
            resultData.interval.end = new Date(endDateInput.value);
        });

        // Recurrence Interval
        const intervalSetting = new Setting(contentEl)
            .setName('Recurrence Interval')
            .setDesc('Repeat every X weeks/months')
            .addText(text => text
                .setValue(resultData.settings.recurrenceInterval.toString())
                .onChange(value => {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 99) {
                        resultData.settings.recurrenceInterval = numValue;
                    }
                }));

        // Periodic Type Selection (Weekly or Monthly)
        const WEEK = 'weekly'
        const MONTH = 'monthly'
        new Setting(contentEl)
            .setName('Recurrence Pattern')
            .setDesc('Select whether to repeat by days of week or days of month')
            .addDropdown(dropdown => dropdown
                .addOption(Periodic.WEEKLY.toString(), 'By days of week')
                .addOption(Periodic.MONTHLY.toString(), 'By days of month')
                .setValue(this.periodicType.toString())
                .onChange(value => {
                    this.periodicType = parseInt(value)
                    this.onOpen()
                }));

        // Container for periodic selection
        const periodicContainer = contentEl.createDiv({ cls: 'periodic-selection-container' });
        this.updatePeriodicSelection(periodicContainer, resultData);

        // Buttons
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText('Create Events')
                .setCta()
                .onClick(() => {
                    this.onSubmit(resultData);
                    this.close();
                }));
    }

    updatePeriodicSelection(container: HTMLElement, resultData: ModelEventSettings) {
        // container.empty();

        resultData.periodicData = {}

        switch (this.periodicType) {
            case Periodic.WEEKLY:
                this.renderWeekDaysSelection(container, resultData);
                break

            case Periodic.MONTHLY:
                this.renderMonthDaysSelection(container, resultData);
                break

            default:
                throw Error('unreachable')
        }
    }

    renderWeekDaysSelection(container: HTMLElement, resultData: ModelEventSettings) {
        container.createEl('p', { text: 'Select days of week:' });

        // Initialize if not exists
        if (!resultData.periodicData.days) {
            resultData.periodicData.days = [];
        }

        const daysMapping = [
            { value: 1, label: 'M', fullName: 'Mon' },
            { value: 2, label: 'T', fullName: 'Tue' },
            { value: 3, label: 'W', fullName: 'Wed' },
            { value: 4, label: 'T', fullName: 'Thu' },
            { value: 5, label: 'F', fullName: 'Fri' },
            { value: 6, label: 'S', fullName: 'Sat' },
            { value: 0, label: 'S', fullName: 'Sun' }
        ];

        const daysGrid = container.createDiv({ cls: 'days-of-week-container' });

        for (let day of daysMapping) {
            const dayDiv = daysGrid.createDiv({ cls: 'day-circle' });
            const checkbox = dayDiv.createEl('input', {
                type: 'checkbox',
                cls: "day-check"
            });
            checkbox.checked = resultData.periodicData.days?.includes(day.value) || false;

            const label = dayDiv.createEl('label', {
                cls: 'day-circle-label',
                text: day.label
            });

            dayDiv.createEl('div', {
                cls: 'day-name',
                text: day.fullName
            });

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    if (!resultData.periodicData.days?.includes(day.value)) {
                        resultData.periodicData.days?.push(day.value);
                    }
                } else {
                    const index = resultData.periodicData.days?.indexOf(day.value);
                    if (index !== undefined && index > -1) {
                        resultData.periodicData.days?.splice(index, 1);
                    }
                }
            });

            dayDiv.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
        }
    }

    renderMonthDaysSelection(container: HTMLElement, resultData: ModelEventSettings) {
        container.createEl('p', { text: 'Select days of month (1-31):' });

        // Initialize if not exists
        if (!resultData.periodicData.dates) {
            resultData.periodicData.dates = [];
        }

        const daysGrid = container.createDiv({ cls: 'days-of-month-container' });

        for (let i = 1; i <= 31; i++) {
            const dayDiv = daysGrid.createDiv({ cls: 'day-of-month' });
            const checkbox = dayDiv.createEl('input', {
                type: 'checkbox',
                cls: "day-check"
            });
            checkbox.checked = resultData.periodicData.dates?.includes(i) || false;

            const label = dayDiv.createEl('label', {
                cls: 'day-of-month-label',
                text: i.toString()
            });

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    if (!resultData.periodicData.dates?.includes(i)) {
                        resultData.periodicData.dates?.push(i);
                    }
                } else {
                    const index = resultData.periodicData.dates?.indexOf(i);
                    if (index !== undefined && index > -1) {
                        resultData.periodicData.dates?.splice(index, 1);
                    }
                }
            });

            dayDiv.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });

            if (i % 7 === 0) {
                daysGrid.createEl('br');
            }
        }

        container.createEl('p', {
            text: 'Note: Dates that don\'t exist in a month (e.g., Feb 30) will be skipped.',
            cls: 'note-text'
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
