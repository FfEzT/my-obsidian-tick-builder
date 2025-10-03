import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, moment } from 'obsidian';

const PLUGIN_NAME = "MyTicker"

type CalendarEventPluginSettings = {
    prefixName: string
    timeStart: string
    timeDuration: string
    days: number[]
    recurrenceInterval: number // Repeate event every X week
}

const DEFAULT_SETTINGS: CalendarEventPluginSettings = {
    prefixName: 'event',
    timeStart: '9h',
    timeDuration: '1h',
    days: [],
    recurrenceInterval: 1,
}

type ModelEventSettings = {
    prefixName: string
    timeStart: string
    timeDuration: string
    days: number[]
    recurrenceInterval: number // Repeate event every X week
    startInterval: Date
    endInterval: Date
}

type TickModel = {
    prefixName: string;
    date: string;
    timeStart: string;
    timeDuration: string;
}

export default class CalendarEventPlugin extends Plugin {
    settings: CalendarEventPluginSettings;
    ribbonIcon: HTMLElement

    async onload() {
        await this.loadSettings();

        this.ribbonIcon = this.addRibbonIcon('calendar-heart', `${PLUGIN_NAME}: Create Ticks`, (evt: MouseEvent) => {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (!activeView) {
                new Notice('No active note found!');
                return;
            }
            const editor = activeView.editor;
            const file = activeView.file;
            if (!editor || !file) {
                notice('Cannot access editor or file!');
                return
            }

            new EventCreationModal(
                this.app, this.settings,
                async (result: ModelEventSettings) => {
                    if (!result)
                        return

                    await this.saveSettings(result)
                    await this.createEvents(result, file)
                }
            ).open()
        })
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings(data: ModelEventSettings) {
        // Преобразуем ModelEventSettings в CalendarEventPluginSettings
        const settings: CalendarEventPluginSettings = {
            prefixName: data.prefixName,
            timeStart: data.timeStart,
            timeDuration: data.timeDuration,
            days: data.days,
            recurrenceInterval: data.recurrenceInterval
        };

        this.settings = settings

        await this.saveData(settings);
    }

    async createEvents(params: ModelEventSettings, file: TFile) {
        try {
            const events = this.generateEvents(params);
            if (events.length === 0) {
                new Notice('No events generated for the selected period!');
                return;
            }

            let eventText = ''
            let index = 0
            for (let event of events) {
                eventText += `- [t::${event.prefixName}_${++index},${event.date},${event.timeStart},${event.timeDuration}]\n`
            }

            // Добавляем события в конец файла
            const content = await this.app.vault.read(file);
            const newContent = content + '\n\n' + eventText;

            await this.app.vault.modify(file, newContent);

            notice(`Created ${events.length} calendar events!`);
        } catch (error) {
            notice('Error creating events: ' + error.message);
            console.error(error);
        }
    }

    generateEvents(params: ModelEventSettings): Array<TickModel> {
        const events: TickModel[] = [];
        let currentDate = moment(params.startInterval);
        const endDate = moment(params.endInterval);

        while (currentDate.isSameOrBefore(endDate)) {
            const currentWeek = currentDate.isoWeek();
            const startWeek = moment(params.startInterval).isoWeek();

            // Вычисляем разницу в неделях
            const weekDiff = currentWeek - startWeek;
            if (params.days.includes(currentDate.day()) &&
                weekDiff % params.recurrenceInterval === 0) {

                const event: TickModel = {
                    prefixName: params.prefixName,
                    date: currentDate.format('YYYY-MM-DD'),
                    timeStart: params.timeStart,
                    timeDuration: params.timeDuration
                }

                events.push(event)
            }

            currentDate = currentDate.add(1, 'day');
        }

        return events;
    }
}

class EventCreationModal extends Modal {
    onSubmit: (result: ModelEventSettings) => void;
    settings: CalendarEventPluginSettings;

    constructor(app: App, settings: CalendarEventPluginSettings, onSubmit: (result: ModelEventSettings) => void) {
        super(app);

        this.settings = settings
        this.onSubmit = onSubmit
    }

    onOpen() {
        const {contentEl} = this;
        contentEl.empty();

        contentEl.createEl('h2', {text: 'Create Calendar Events'});

        let prefixName = this.settings.prefixName;
        let timeStart = this.settings.timeStart;
        let timeDuration = this.settings.timeDuration;
        let days = this.settings.days
        let recurrenceInterval = this.settings.recurrenceInterval;

        // let startDate = this.settings.defaultStartDate || moment().format('YYYY-MM-DD');
        // let endDate = this.settings.defaultEndDate || moment().add(1, 'month').format('YYYY-MM-DD');
        // let recurrencePattern = this.settings.recurrencePattern;
        // let specificDays = [...this.settings.specificDays];

        new Setting(contentEl)
            .setName('Prefix Name')
            .setDesc('Base name for events (e.g., "meeting", "class")')
            .addText(text => text
                .setValue(prefixName)
                .onChange(value => prefixName = value));

        new Setting(contentEl)
            .setName('Start Time')
            .setDesc('Event start time (12h)')
            .addText(text => text
                .setValue(timeStart)
                .setPlaceholder('12h30m')
                .onChange(value => timeStart = value));

        new Setting(contentEl)
            .setName('Duration')
            .setDesc('Event duration (1h30m)')
            .addText(text => text
                .setValue(timeDuration)
                .setPlaceholder('15m')
                .onChange(value => timeDuration = value));

        const startDateSetting = new Setting(contentEl)
            .setName('Start Date')
            .setDesc('Select start date for events');

        // Создаем контейнер для календаря и текстового поля
        const startDateContainer = startDateSetting.descEl.createDiv({cls: 'date-picker-container'});

        // HTML5 date input
        const startDateInput = startDateContainer.createEl('input', {
            type: 'date',
            cls: 'date-picker'
        });
        startDateInput.value = moment().format('YYYY-MM-DD');
        // dateInput.addEventListener('change', (e) => {
        //     startDate = (e.target as HTMLInputElement).value;
        // });

        // Календарь для даты окончания
        const endDateSetting = new Setting(contentEl)
            .setName('End Date')
            .setDesc('Select end date for events');

        const endDateContainer = endDateSetting.descEl.createDiv({cls: 'date-picker-container'});
        const endDateInput = endDateContainer.createEl('input', {
            type: 'date',
            cls: 'date-picker'
        });
        endDateInput.value = moment().add(7, "d").format('YYYY-MM-DD')
        endDateInput
        // endDateInput.addEventListener('change', (e) => {
        //     endDate = (e.target as HTMLInputElement).value;
        // })

        // Поле для даты начала
        // new Setting(contentEl)
        //     .setName('Start Date')
        //     .setDesc('Start date for events (YYYY-MM-DD)')
        //     .addText(text => text
        //         .setValue(startDate)
        //         .setPlaceholder('2024-01-01')
        //         .onChange(value => startDate = value));

        // Поле для даты окончания
        // new Setting(contentEl)
        //     .setName('End Date')
        //     .setDesc('End date for events (YYYY-MM-DD)')
        //     .addText(text => text
        //         .setValue(endDate)
        //         .setPlaceholder('2024-12-31')
        //         .onChange(value => endDate = value));

        // Выбор паттерна повторения
        // new Setting(contentEl)
        //     .setName('Recurrence Pattern')
        //     .setDesc('How often events repeat')
        //     .addDropdown(dropdown => dropdown
        //         .addOption('daily', 'Daily')
        //         .addOption('weekly', 'Weekly')
        //         .addOption('monthly', 'Monthly')
        //         .setValue(recurrencePattern)
        //         .onChange(value => recurrencePattern = value));

        const weekIntervalSetting = new Setting(contentEl)
            .setName('Week Interval')
            .setDesc('Repeat every X weeks')
            .addText(text => text
                .setValue(recurrenceInterval.toString() || '1')
                .onChange(
                    value => {
                        const numValue = parseInt(value);
                        if (isNaN(numValue) || numValue < 1 && numValue >= 100) {
                            notice("Error: Week Interval: Must be in [1,100]")
                            recurrenceInterval = 0
                        }
                        recurrenceInterval = numValue;
                    }
                ));

        // Выбор дней недели
        const daysContainer = contentEl.createDiv();
        daysContainer.createEl('p', {text: 'Select days:'});

        const daysMapping = [
            {value: 1, label: 'M', fullName: 'Mon'},
            {value: 2, label: 'T', fullName: 'Tue'},
            {value: 3, label: 'W', fullName: 'Wed'},
            {value: 4, label: 'T', fullName: 'Thu'},
            {value: 5, label: 'F', fullName: 'Fri'},
            {value: 6, label: 'S', fullName: 'Sat'},
            {value: 0, label: 'S', fullName: 'Sun'}
        ];

        const daysGrid = daysContainer.createDiv({cls: 'days-of-week-container'});

        for (let day of daysMapping) {
            const dayDiv = daysGrid.createDiv({cls: 'day-circle'});
            const checkbox = dayDiv.createEl('input', {
                type: 'checkbox', cls: "day-check"
            });
            checkbox.checked = days.includes(day.value);

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
                    if (!days.includes(day.value)) {
                        days.push(day.value);
                    }
                } else {
                    days = days.filter(d => d !== day.value);
                }
            });

            // Клик по всей области дня
            dayDiv.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
        }

        // Кнопки
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => this.close()))
            .addButton(btn => btn
                .setButtonText('Create Events')
                .setCta()
                .onClick(() => {
                    const result: ModelEventSettings = {
                        prefixName,
                        timeStart,
                        timeDuration,
                        days,
                        recurrenceInterval,
                        startInterval: new Date(startDateInput.value),
                        endInterval: new Date(endDateInput.value),
                    }
                    this.onSubmit(result);
                    this.close();
                }));
    }

    onClose() {
        const {contentEl} = this;
        contentEl.empty();
    }
}

function notice(message: string) {
    new Notice(
        `${PLUGIN_NAME}: ${message}`
    )
}











/*
import { App, Plugin, PluginManifest, TFile, WorkspaceLeaf } from 'obsidian';
import { CalendarView} from "./views/CalendarView"
import { Cache } from "./cache"
import { PluginSettings, Src } from './types';
import { MySettingTab } from './setting';
import { DEFAULT_SETTINGS, CACHE_ID, MSG_PLG_NAME, VIEW_TYPE } from './constants';
import StatusCorrector from './views/StatusCorrector';
import { TickChecker } from './views/TickCheker';
import NoteManager from './NoteManager';
import { VaultOps } from './vaultOps';


export default class MyPlugin extends Plugin {
  private noteManager: NoteManager

  private cache: Cache

  private statusCorrector: StatusCorrector

  private settings: PluginSettings

  private tickChecker: TickChecker | void

  private calendar: CalendarView | void

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest)

    const noteManager = new NoteManager(
      this.app.vault,
      this.app.metadataCache,
      this.app.fileManager,
      this.app.workspace
    )
    this.noteManager = noteManager

    // создавать при onload и тогда же запускать initStorage
    this.cache = new Cache(this.noteManager, this.app.vault)
  }

  public async onload() {
    await this.loadSettings()

    this.initRegister()

    const src: Src[] = []
    for (let i of this.settings.source.noteSources) {
      const tmp = Src.fromSrcJson(i)
      if (tmp)
        src.push(tmp)
    }

    this.tickChecker = new TickChecker(
      CACHE_ID.TICK_CHECKER,
      src,
      this.cache,
      this.noteManager
    )

    if (this.settings.statusCorrector.isOn) {
      this.statusCorrector = new StatusCorrector(
        CACHE_ID.STATUS_CORRECTOR,
        src,
        this.cache,
        this.noteManager
      )

      if (this.settings.statusCorrector.startOnStartUp)
        this.statusCorrector.correctAllNotes()

      this.addCommand({
        id: 'fullStatusCorrect',
        name: MSG_PLG_NAME + 'Full StatusCorrector',
        callback: () => {
          this.statusCorrector.correctAllNotes()
        }
      });
    }

    this.app.workspace.onLayoutReady(() => this.init())

    this.registerView(
        VIEW_TYPE,
        (leaf: WorkspaceLeaf) => {
          this.calendar = new CalendarView(
            leaf,
            CACHE_ID.CALENDAR,
            src,
            this.settings.calendar,
            this.cache,
            this.noteManager,
            this.settings.source.defaultCreatePath
          )

          return this.calendar
        }
    )

    this.addRibbonIcon("info", MSG_PLG_NAME + "Open Calendar", () => this.activateView())

    this.addCommand({
      id: 'reset-cache',
      name: MSG_PLG_NAME + 'Reset Cache',
      callback: () => {
        this.cache.reset()
      }
    })
    this.addCommand({
      id: 'log-cache',
      name: MSG_PLG_NAME + 'Log Cache',
      callback: () => {
        this.cache.log()
      }
    });
  }

  public onunload() {
    // TODO как будто других не хватает destoy

    // if (this.settings?.statusCorrector.isOn)
      this.statusCorrector?.destroy()
  }

  private async init() {
    await this.cache.init()

    this.tickChecker?.init()
    this.statusCorrector?.init()
  }

  private initRegister() {
    this.registerEvent(
      this.app.metadataCache.on("changed", file => {
        this.cache.changeFile(file)
      })
    )

    this.registerEvent(
      this.app.vault.on(
        "rename",
        (file, oldPath) => {
          // проверка на то, что это файл, а не папка
          if (!(file as TFile).basename)
            return

          this.cache.renameFile(file as TFile, oldPath)
        }
      )
    )

    this.registerEvent(
      this.app.vault.on(
        "delete",
        file => this.cache.deleteFile(file)
      )
    )

    this.registerEvent(
      this.app.vault.on(
        "create",
        file => {
          // проверка на то, что это файл, а не папка
          if (!(file as TFile).basename)
            return

          this.cache.addFile(file as TFile)
        }
      )
    )
  }

  private async activateView() {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE)
    if (leaves.length === 0) {
      const leaf = this.app.workspace.getLeaf(false);
      await leaf.setViewState({
        type: VIEW_TYPE,
        active: true,
      })
    }
    else if (leaves.length === 1) {
      (leaves[0].view as CalendarView).onOpen()
      this.app.workspace.setActiveLeaf(leaves[0])
    }
    else for (let leaf of leaves)
      leaf.detach()
  }


  // Settings

  public getSettings(): PluginSettings {
    // NOTE: full copy
    return JSON.parse(
      JSON.stringify(this.settings)
    )
  }

  public async saveSettings(settings: PluginSettings) {
    this.settings = settings
    await this.saveData(this.settings);
  }



  private async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())

    // settings.source.noteSources = settings.source.noteSources.map(
    //   (el:any) => {
    //     const res = new Src(el.path)
    //     for (let i of el.excludes) {
    //       res.addExcludes(i)
    //     }

    //     return res
    //   }
    // )


    this.addSettingTab(
      new MySettingTab(
        this.app,
        this,
        new VaultOps(this.app.vault)
      )
    );
  }
}
*/
