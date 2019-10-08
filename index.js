const AudioContext = window.AudioContext || window.webkitAudioContext;

const audioContext = new AudioContext();

class Logger {

    constructor(name = 'unknown') {
        this._logger_prefix = `♪♪(o*゜∇゜)o～♪♪ > ${name}: `;
    }

    log(msg) {
        console.log(`${this._logger_prefix}${msg}`);
    }

    warn(msg) {
        console.warn(`${this._logger_prefix}${msg}`);
    }

    error(msg) {
        throw `${this._logger_prefix}${msg}`;
    }

}

class Melody extends Logger {

    constructor(notes = []) {
        super('Melody');
        this.set(notes);
    }

    transposeNote({note, ht, oct, duration}, shift) {
        return {note, ht: ht + shift, oct, duration};
    }

    tempNote({note, ht, oct, duration}, newDuration) {
        return {note, ht, oct, duration: duration * newDuration};
    }

    normalize(notes) {
        return notes.map(({note, ht = 0, oct = 0, duration = 1}) => {
            return {note, ht, oct, duration};
        });
    }

    set(notes) {
        this._notes = this.normalize(notes);

        return this;
    }

    length() {
        return this._notes.length;
    }

    copy() {
        return this._notes.slice();
    }

    clone() {
        return this.constructor(this.copy());
    }

    repeat(shape, fitTemp = true) {
        let original = this.copy();
        let new_notes = [];

        let temper = null;

        if (Number.isInteger(shape)) {
            /**
             * If argument is Integer
             * loop composition {shape} times
             */
            for (let i = 0; i < shape; i++) {
                new_notes = new_notes.concat(original);
            }

            if (fitTemp) {
                temper = 1 / shape;
            }
        } else if (Array.isArray(shape)) {
            let shapeLength = shape.length;
            let compositionLength = this.length();

            /**
             * If argument is Array with one element
             * loop each note {shape[0]} times
             */
            if (shapeLength === 1 && compositionLength > 1) {
                shape = Array(compositionLength).fill(shape[0]);
                shapeLength = compositionLength;
            }

            /**
             * If argument is Array with several elements
             * loop {i}-note {shape[i]} times
             */
            if (shapeLength === this.length()) {
                temper = [];

                new_notes = original.reduce((acc, note, i) => {
                    temper = temper.concat(Array(shape[i]).fill(1 / shape[i]));

                    return acc.concat(Array(shape[i]).fill(note));
                }, []);
            } else {
                console.warn(`repeat: invalid shape length, ${shapeLength} instead of ${this.length()}`, shape);
            }
        } else {
            console.warn(`repeat: invalid arguments`, shape);
        }

        this.set(new_notes);

        if (temper !== null) {
            this.temp(temper);
        }

        return this;
    }

    transform(shape, transformator, name = 'unknown transform') {
        if (typeof shape === 'number') {

            this._notes = this._notes.map(note => transformator(note, shape));

        } else if (Array.isArray(shape)) {

            let shapeLength = shape.length;

            if (shapeLength === this.length()) {
                this._notes = this._notes.map((note, i) => transformator(note, shape[i]));
            } else {
                console.warn(`${name}: invalid shape length, ${shapeLength} instead of ${this.length()}`, shape);
            }

        } else {

            console.warn(`${name}: invalid arguments`, shape);

        }

        return this;
    }

    transpose(shape) {
        return this.transform(shape, this.transposeNote, 'transpose');
    }

    temp(shape) {
        return this.transform(shape, this.tempNote, 'temp');
    }

    each(joiner) {
        this._notes = joiner(this._notes.map(note => {

            return new this.constructor([note]);

        })).reduce((result, oneOfSplitted) => {

            return result.concat(oneOfSplitted.copy());

        }, []);

        return this;
    }

    map(mapper) {
        return this.each(notes => notes.map(mapper));
    }

    arpeggio(arp) {
        return this.repeat(arp.length).transpose(arp);
    }

    chord6(tune = 'maj') {
        let tr = [];

        switch (tune) {
            case 'maj':
                tr = [0, 7, 12, 16, 19, 24];
                break;

            case 'min':
                tr = [0, 7, 12, 15, 19, 24];
                break;

            default:
                console.warn(`chord6: invalid tune ${tune}`)
        }

        return this.arpeggio(tr);
    }

    prolongLast(D = 1) {
        let length = this.length();

        if (length < D) {
            console.warn(`prolongLast: invalid duration ${D} (max is ${length})`);
            return this;
        }

        let d = (length - D) / (length - 1);
        let temp = [];

        for (let i = 0; i < length - 1; i++) {
            temp.push(d);
        }

        temp.push(D);

        return this.temp(temp);
    }

    loop(n) {
        return this.repeat(n, false);
    }

    /**
     * Some built-in arpeggios ;)
     */
    blueMondayBass() {
        return this.arpeggio([24, 0, 12, 0]);
    }

    funkyBass() {
        return this.arpeggio([0, 12, 0, 12]);
    }

}

class Serializator extends Logger {

    constructor(name, Constructor) {
        super(name);

        this.Constructor = Constructor;

        this._storage = {};
        this._current = null;
    }

    make(...args) {
        this._current = new (this.Constructor.bind.apply(this.Constructor, [null].concat(args)));

        return this;
    }

    save(name) {
        if (this._current === null) {
            this.error(`couldn\'t save "${name}" because melody is not defined`);
        }

        this._storage[name] = this._current;

        return this;
    }

    clone(name) {
        let stored = this.get(name);

        if (stored.clone === undefined) {
            this.error(`couldn\'t clone "${name}" because "${this.Constructor.name}" has no cloning method`);
        }

        this._current = stored.clone();

        return this;
    }

    get(name) {
        let stored = this._storage[name];

        if (stored === undefined) {
            this.error(`couldn\'t get "${name}" because it\'s not defined`);
        }

        return stored;
    }

    change(changer) {
        this._current = changer(this._current);

        return this;
    }

}

class AudioBase extends Logger {

    constructor(name) {
        super(name);

        this.MS_PER_SECOND = 1000;
        this.MIN_VALUE = 0.0001;

        this.context = audioContext;
        this.is_active = true;
    }

    destroy() {

    }

    getContext() {
        return this.context;
    }

    getCurrentTime() {
        return this.context.currentTime;
    }

    setActiveState(state) {
        this.is_active = state;
    }

    setParamAt(param, v, t0, T, is_first = false) {
        if (param !== null) {
            if (is_first) {
                param.setValueAtTime(v, this.getCurrentTime() + t0 / this.MS_PER_SECOND);
            } else {
                param.linearRampToValueAtTime(this.minVal(v), this.getCurrentTime() + (t0 + T) / this.MS_PER_SECOND);
            }
        }
    }

    isActive() {
        return this.is_active;
    }

    minVal(v) {
        if (v === 0) {
            return this.MIN_VALUE;
        } else {
            return v;
        }
    }

}

class Context extends AudioBase {

    constructor() {
        super('Context');
    }

    getDestination() {
        return this.context.destination;
    }

}

class Noise extends AudioBase {

    constructor({type = null, gain = 1}, context) {
        super('Noise', context);

        if (type === null) {
            this.setActiveState(false);
        } else {
            let sampleRate = this.getContext().sampleRate;
            let bufferSize = sampleRate * 2;
            let noiseBuffer = this.getContext().createBuffer(1, bufferSize, sampleRate);
            let output = noiseBuffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i++) {
                output[i] = Math.random() * 2 - 1;
            }

            this.noise = this.getContext().createBufferSource();
            this.noise.buffer = noiseBuffer;
            this.noise.loop = true;

            this.gain = this.getContext().createGain();
            this.gain.gain.value = gain;

            this.noise.connect(this.gain);
        }

        this.is_started = false;
    }

    destroy() {

    }

    plugInto(destination) {
        if (this.isActive()) {
            this.gain.connect(destination);
            return this;
        } else {
            return null;
        }
    }

    start() {
        if (this.isActive()) {
            this.noise.start();
            this.is_started = true;
        }
    }

    stop() {
        if (this.isActive()) {
            this.noise.stop();
            this.is_started = false;
        }
    }

    getGainSocket() {
        if (this.isActive()) {
            return this.gain.gain;
        } else {
            return null;
        }
    }
}

class Filter extends AudioBase {
    constructor({type = null, freq = 220, gain = 1, detune = 100, Q = 100}, context) {
        super('Filter', context);

        if (type === null) {
            this.setActiveState(false);
        } else {
            this.filter = this.getContext().createBiquadFilter();

            this.filter.type = type;
            this.filter.frequency.value = freq;
            this.filter.gain.value = gain;
            // this.filter.detune.value = detune;
            // this.filter.Q.value = Q;
        }
    }

    destroy() {

    }

    getInput() {
        return this.filter;
    }

    getFreqSocket() {
        return this.filter.frequency;
    }

    getGainSocket() {
        return this.filter.gain;
    }

    getDetuneSocket() {
        return this.filter.detune;
    }

    getQSocket() {
        return this.filter.Q;
    }

    plugInto(destination) {
        if (this.isActive()) {
            this.filter.connect(destination);
            return this;
        } else {
            return null;
        }
    }
}

class Oscillator extends AudioBase {

    constructor({type = 'sine', freq = 0, gain = 1}, context) {
        super('Oscillator', context);

        this.gain = this.getContext().createGain();
        this.gain.gain.value = gain;

        this.oscillator = this.getContext().createOscillator();
        this.oscillator.frequency.value = freq;

        this.setType(type);

        this.oscillator.connect(this.gain);

        this.is_started = false;
    }

    destroy() {

    }

    getGainSocket() {
        return this.gain.gain;
    }

    getFreqSocket() {
        return this.oscillator.frequency;
    }

    setType(type) {
        switch (type) {
            case 'sine':
            case 'triangle':
            case 'square':
            case 'sawtooth':
                this.oscillator.type = type;
                break;

            case 'saw':
                this.oscillator.type = 'sawtooth';
                break;

            default:
                let sin = [];
                let cos = [];

                switch (type) {
                    case 'violin':
                        sin = [0, 1, 4/9, 4/9, 4/9, 6/9, 5/9, 6/9, 5/9, 3/9, 3/9, 2/9, 1/9, 2/9, 2/9, 1/9];
                        break;

                    case 'viola':
                        sin = [0, 3/6, 1, 5/12, 5/6, 2/6, 4/6, 1/6, 2/6, 1/12, 1/6];
                        break;

                    case 'string_a':
                        sin = [0, 1, 37/40, 33/40, 23/40, 2/40, 18/40, 22/40, 21/40, 14/40, 2/40, 11/40, 16/40, 15/40, 8/40, 2/40, 6/40, 12/40, 11/40, 5/40];
                        break;

                    case 'bass':
                        sin = [0, 1, 0.8144, 0.2062, 0.0206];
                        break;

                    case 'horn':
                        sin = [0, 0.4, 0.4, 1, 1, 1, 0.3, 0.7, 0.6, 0.5, 0.9, 0.8];
                        break;

                    case 'chiptune':
                        for (let i = 1; i < 100; i++) {
                            sin.push(4 / (i * Math.PI) * Math.sin(Math.PI * i * 0.18));
                        }
                        break;

                    case 'organ_1':
                        sin = [0, 1, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1];
                        break;

                    case 'organ_2':
                        sin = [0, 0.8, 0.6, 0.6, 0.7, 0.6, 0, 0.8, 0.3, 1];
                        break;

                    case 'exp1':
                        /* При низких частотах напоминает тромбон */
                        for (let i = 1; i < 50; i++) {
                            let v = Math.exp(1 - Math.sqrt(2*i));
                            sin.push(v);
                        }
                        break;

                    case 'exp2':
                        /* При низких частотах напоминает басс */
                        for (let i = 1; i < 50; i++) {
                            let v = Math.exp(1 - Math.pow(Math.log(i+2), 2));
                            sin.push(v);
                        }
                        break;

                    case 'exp3':
                        /* Духовые */
                        for (let i = 1; i < 50; i++) {
                            let v = Math.exp(1 - i);
                            sin.push(v);
                        }
                        break;

                    case 'exp4':
                        /* При низких частотах напоминает басс */
                        for (let i = 1; i < 50; i++) {
                            let v = 1.5 * Math.cos(Math.pow(i, 2)) / Math.pow(i, 2);
                            sin.push(v);
                        }
                        break;

                    default:
                        this.error(`unknown wave type "${type}"`);
                }

                let imag = new Float32Array(sin.length > 0 ? sin : cos.length);
                let real = new Float32Array(cos.length > 0 ? cos : sin.length);

                this.oscillator.setPeriodicWave(this.getContext().createPeriodicWave(real, imag));
        }
    }

    start() {
        this.oscillator.start();
        this.is_started = true;
    }

    stop() {
        let endDuration = 100;

        this.setParamAt(this.getGainSocket(), 0, 0, endDuration);

        setTimeout(() => {
            this.oscillator.stop();
        }, endDuration);

        this.is_started = false;
    }

    plugInto(destination) {
        if (this.isActive()) {
            this.gain.connect(destination);
            return this;
        } else {
            return null;
        }
    }
}

class Envelope extends Logger {

    constructor(envelope) {
        super('Envelope');
        this.envelope = this.normalize(envelope);
    }

    destroy() {

    }

    normalize(envelope, default_envelope = []) {
        if (typeof envelope === 'string') {
            /**
             * damp({X})*master
             * @type {{groups: {}}|RegExpExecArray}
             */
            let exp_match = /(.+)\(([\.\d]+)\)(?:\*([\.\d]+))?/.exec(envelope);

            if (exp_match !== null) {
                switch (exp_match[1]) {
                    case 'damp':
                        let alpha = parseFloat(exp_match[2]) || 1;
                        let beta = parseFloat(exp_match[3]) || 1;
                        let N = 4;

                        envelope = [[0, 0]];

                        envelope.push([0.01, beta]);

                        for (let i = 1; i <= N; i++) {
                            let v = i < N ? Math.exp(-alpha * i) : 0;
                            envelope.push([i / N, v * beta]);
                        }
                        break;

                    default:
                        this.error(`unknown envelope function "${exp_match[1]}" in "${envelope}"`);
                }
            } else {
                /**
                 * Named envelopes
                 */
                switch (envelope) {
                    case 'bowed-string':
                        envelope = [
                            [0.0, 0.2],
                            [0.1, 0.7],
                            [0.5, 1.0],
                            [0.8, 0.7],
                            [1.0, 0.1],
                        ];
                        break;

                    case 'plucked-string':
                        envelope = [
                            [0.0, 0.0],
                            [0.05, 1.0],
                            [0.8, 0.2],
                            [1.0, 0.0],
                        ];
                        break;

                    case 'drum-kick':
                        envelope = [
                            [0.0, 0.0],
                            [0.01, 1.0],
                            [1.0, 0.0],
                        ];
                        break;

                    case 'drum-hihat':
                        envelope = [
                            [0.0, 0.0],
                            [0.01, 1.0],
                            [0.1, 0.1],
                            [0.2, 0.01],
                            [1.0, 0.0],
                        ];
                        break;

                    case '10':
                        envelope = [
                            [0.0, 0.0],
                            [0.01, 1.0],
                            [1.0, 0.0],
                        ];
                        break;

                    default:
                        this.error(`unknown envelope "${envelope}"`);
                        break;
                }
            }
        }

        if (envelope.length === 0) {
            this.warn(`envelope has zero length. Use default`);
            envelope = default_envelope;
        }

        return envelope;
    }

    length() {
        return this.envelope.length;
    }

    reduce(t0, T, master_v = 1, zeroing_first = false, zeroing_last = false) {
        let envelope_length = this.length();

        if (envelope_length < 3) {
            zeroing_first = false;
            zeroing_last = false;
        }

        return this.envelope.reduce((acc, [t, v], i) => {
            if (zeroing_first && i === 0) {
                v = 0;
            } else if (zeroing_last && (i === envelope_length - 1)) {
                v = 0;
            }

            acc.push([t0, t * T, v * master_v]);

            return acc;
        }, []);
    }

}

class Instrument extends Logger {

    constructor({temp = 1000, oct = 0, osc = {}, filter = {}, noise = {}, envelopes = {}, LFOs = {}, masterGain = 1}) {
        super('Instrument');

        this.BASE_N = 12;
        this.BASE_FREQ = 440;

        this.NOTES_MAP = {
            'A': 0,
            'A#': 1,
            'B': 2,
            'C': 3,
            'C#': 4,
            'D': 5,
            'D#': 6,
            'E': 7,
            'F': 8,
            'F#': 9,
            'G': 10,
            'G#': 11,
        };

        this.temp = temp;
        this.base_octave = oct;
        this.masterGain = masterGain;

        this.context = new Context();

        this.osc = new Oscillator(osc, this.context.getContext());
        this.noise = new Noise(noise, this.context.getContext());
        this.filter = new Filter(filter, this.context.getContext());

        this.envelopes = this.createModifiers(envelopes, Envelope, {
            'osc.freq': [[0, 1], [1, 1]],
            'osc.gain': [[0, 1], [1, 1]],
            'noise.gain': [[0, 1], [1, 1]],
        });

        this.LFOs = this.createModifiers(LFOs, Oscillator, {}, ({n = 1, gain = 1}) => {
            return {
                freq: n * 1000 / this.temp,
                gain: this.masterGain * gain,
            };
        });

        this.connectLFOs();

        this.connectInSeries([this.osc, this.filter]).plugInto(this.context.getDestination());
        this.connectInSeries([this.noise]).plugInto(this.context.getDestination());
    }

    connectInSeries(series) {
        return series.reduce((left, right) => {
            if (left === null) {
                left = right;
            } else if (right !== null && right.isActive()) {
                left.plugInto(right.getInput());

                left = right;
            }

            return left;

        }, null);
    }

    useEnvelope(name, callback) {
        let envelope = this.envelopes[name];

        if (envelope !== undefined) {
            callback(envelope);
        }
    }

    destroy() {
        this.osc.stop();
        this.noise.stop();
        this.stopLFOs();
    }

    connectLFOs() {
        for (let name in this.LFOs) {

            let LFO = this.LFOs[name];

            switch (name) {
                case 'osc.freq':
                    LFO.plugInto(this.osc.getFreqSocket());
                    break;

                case 'osc.gain':
                    LFO.plugInto(this.osc.getGainSocket());
                    break;

                case 'filter.freq':
                    LFO.plugInto(this.filter.getFreqSocket());
                    break;

                default:
                    this.error(`Unknown LFO target "${name}"`);
            }
        }
    }

    startLFOs() {
        for (let name in this.LFOs) {
            this.LFOs[name].start();
        }
    }

    stopLFOs() {
        for (let name in this.LFOs) {
            this.LFOs[name].stop();
        }
    }

    createModifiers(items, Constructor, defaultItems = {}, paramsConverter = null) {
        let modifiers = {};

        items = Object.assign(defaultItems, items);

        for (let name in items) {
            let params = items[name];

            if (paramsConverter !== null) {
                params = Object.assign(params, paramsConverter(params));
            }

            modifiers[name] = new Constructor(params, this.context.getContext());
        }

        return modifiers;
    }

    nToMs(n) {
        return n * this.temp;
    }

    iToFreq(i) {
        return Math.pow(2, i / this.BASE_N) * this.BASE_FREQ;
    }

    noteToFreq(note, oct = 0, ht = 0) {
        if (note === '0') {
            return 0;
        } else {
            let i = this.NOTES_MAP[note];

            if (i === undefined) {
                return null;
            }

            return this.iToFreq(i + ht + oct * this.BASE_N);
        }
    }

    normalizeCompositionItem({type = 'note', note = 'A', oct = 0, ht = 0, duration = 1, delay = 0}) {
        return {
            type,
            note,
            oct,
            ht,
            duration: this.nToMs(duration),
            delay: this.nToMs(delay),
            is_first: false,
            is_last: false,
        };
    }

    normalizeComposition(composition) {
        composition = composition.map(item => this.normalizeCompositionItem(item));

        composition[0].is_first = true;
        composition[composition.length - 1].is_last = true;

        return composition;
    }

    compositionToSchedule(composition) {
        let freq = [];
        let gain = [];
        let filterFreq = [];
        let noiseGain = [];

        let current_time = 0;

        composition.forEach(({note, oct, duration, delay, is_first = false, is_last = false, ht}) => {
            let oscFreq = this.noteToFreq(note, oct + this.base_octave, ht);

            /**
             * Если частота ноты нулевая, значит это пауза
             */
            if (oscFreq > 0) {
                this.useEnvelope('osc.freq', envelope => {
                    freq.push(envelope.reduce(
                        current_time,
                        duration,
                        oscFreq
                    ));
                });

                this.useEnvelope('osc.gain', envelope => {
                    gain.push(envelope.reduce(
                        current_time,
                        duration,
                        this.masterGain,
                        is_first,
                        is_last
                    ));
                });

                this.useEnvelope('noise.gain', envelope => {
                    noiseGain.push(envelope.reduce(
                        current_time,
                        duration,
                        this.masterGain,
                        is_first,
                        is_last
                    ));
                });

                this.useEnvelope('filter.freq', envelope => {
                    filterFreq.push(envelope.reduce(
                        current_time,
                        duration,
                    ));
                });
            } else if (is_first) {
                this.useEnvelope('noise.gain', envelope => {
                    noiseGain.push(envelope.reduce(
                        current_time,
                        duration,
                        0,
                        is_first,
                        is_last
                    ));
                });
            }

            current_time += duration;
        });

        return {
            freq,
            gain,
            filterFreq,
            noiseGain,
            duration: current_time,
        };
    }

    play(composition) {
        this.osc.start();
        this.noise.start();
        this.startLFOs();

        composition = this.normalizeComposition(composition);

        return this.playScheduled(this.compositionToSchedule(composition));
    }

    playScheduled({freq, gain, filterFreq, noiseGain, duration}) {
        freq.forEach(sched => {
            sched.forEach(([t0, T, v], i) => {
                this.context.setParamAt(this.osc.getFreqSocket(), v, t0, T, i === 0);
            });
        });

        gain.forEach(sched => {
            sched.forEach(([t0, T, v], i) => {
                this.context.setParamAt(this.osc.getGainSocket(), v, t0, T, i === 0);
            });
        });

        noiseGain.forEach(sched => {
            sched.forEach(([t0, T, v], i) => {
                this.context.setParamAt(this.noise.getGainSocket(), v, t0, T, i === 0);
            });
        });

        filterFreq.forEach(sched => {
            sched.forEach(([t0, T, v], i) => {
                this.context.setParamAt(this.filter.getFreqSocket(), v, t0, T, i === 0);
            });
        });

        return this.createWaitPromise(duration);
    }

    createWaitPromise(duration) {
        if (duration > 0) {
            return new Promise(resolve => {
                setTimeout(resolve, duration, this);
            });
        } else {
            return Promise.resolve(this);
        }
    }

}

class Surferrosa extends Logger {

    constructor() {
        super('Surferrosa');
        this.song = new Serializator('Album', Melody);
        this.instrument = new Serializator('Band', Instrument);
    }

    play(map, loop = 1) {
        let instrumentsAndMelodies = [];

        for (let instrumentName in map) {
            instrumentsAndMelodies.push({
                instrument: this.instrument.get(instrumentName),
                melody: this.song.get(map[instrumentName]).loop(loop).copy(),
            });
        }

        return Promise.all(instrumentsAndMelodies.map(({instrument, melody}) => {
            return instrument.play(melody);
        })).then(tracks => {
            tracks.forEach(track => track.destroy());
        });
    }

}

module.exports = Surferrosa;