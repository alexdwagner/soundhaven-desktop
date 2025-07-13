-- Add waveform_data and preprocessed_chunks columns to tracks table
ALTER TABLE tracks ADD COLUMN waveform_data TEXT;
ALTER TABLE tracks ADD COLUMN preprocessed_chunks TEXT; 